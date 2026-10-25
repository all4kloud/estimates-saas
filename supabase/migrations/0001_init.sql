-- =====================================================================
--  Estimates & Invoices — esquema multi-negocio (multi-tenant)
--  Cada fila de negocio lleva business_id; el acceso se controla con RLS.
-- =====================================================================
create extension if not exists pgcrypto;

-- ---------- perfiles (1:1 con auth.users) ----------
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null,
  full_name     text not null default '',
  phone         text not null default '',
  ui_lang       text not null default 'es' check (ui_lang in ('es','en')),
  is_superadmin boolean not null default false,
  created_at    timestamptz not null default now()
);

-- crea el perfil automáticamente al crear/invitar un usuario
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, coalesce(new.email,''), coalesce(new.raw_user_meta_data->>'full_name',''))
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.handle_user_email_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set email = coalesce(new.email,'') where id = new.id;
  return new;
end $$;
create trigger on_auth_user_email after update of email on auth.users
  for each row execute function public.handle_user_email_change();

-- ---------- negocios ----------
create table public.businesses (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  slug             text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  owner_name       text not null default '',
  address1         text not null default '',
  address2         text not null default '',
  phone            text not null default '',
  email            text not null default '',
  website          text not null default '',
  tagline          text not null default '',
  logo_url         text,
  brand_color      text not null default '#1b3566' check (brand_color ~ '^#[0-9a-fA-F]{6}$'),
  accent_color     text not null default '#1f9a9a' check (accent_color ~ '^#[0-9a-fA-F]{6}$'),
  default_lang     text not null default 'en' check (default_lang in ('en','es')),
  tax_rate         numeric(6,3) not null default 0 check (tax_rate >= 0 and tax_rate < 100),
  valid_days       int not null default 30 check (valid_days between 1 and 365),
  payment_text_en  text not null default '',
  payment_text_es  text not null default '',
  terms_est_en     text not null default 'This estimate is valid for {days} days. Pricing is based on an on-site visual inspection; any change to the scope of work will be agreed with you before we start.',
  terms_est_es     text not null default 'Este estimado es válido por {days} días. Los precios se basan en una inspección visual en sitio; cualquier cambio en el trabajo se acordará con usted antes de empezar.',
  estimate_prefix  text not null default 'E-',
  invoice_prefix   text not null default 'INV-',
  next_estimate    int not null default 1001,
  next_invoice     int not null default 1001,
  stripe_account_id      text,
  stripe_charges_enabled boolean not null default false,
  active           boolean not null default true,
  created_at       timestamptz not null default now()
);

-- ---------- membresías y roles ----------
create table public.memberships (
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  role        text not null check (role in ('owner','admin','member')),
  created_at  timestamptz not null default now(),
  primary key (business_id, user_id)
);
create index on public.memberships (user_id);

-- ---------- funciones de autorización (usadas por RLS) ----------
create or replace function public.is_superadmin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_superadmin from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.has_role(bid uuid, roles text[] default array['owner','admin','member'])
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_superadmin() or exists (
    select 1 from public.memberships m
    join public.businesses b on b.id = m.business_id
    where m.business_id = bid and m.user_id = auth.uid() and m.role = any(roles) and b.active
  )
$$;

-- ---------- catálogo de servicios ----------
create table public.services (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name_en     text not null,
  name_es     text not null default '',
  price       numeric(12,2) not null default 0 check (price >= 0),
  sort        int not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create index on public.services (business_id, sort);

-- ---------- clientes del negocio ----------
create table public.customers (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name        text not null check (length(trim(name)) > 0),
  phone       text not null default '',
  email       text not null default '',
  address     text not null default '',
  lang        text not null default 'en' check (lang in ('en','es')),
  notes       text not null default '',
  created_at  timestamptz not null default now()
);
create index on public.customers (business_id, name);

-- ---------- estimados y facturas ----------
create table public.documents (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references public.businesses(id) on delete cascade,
  type             text not null check (type in ('estimate','invoice')),
  number           text,
  customer_id      uuid not null references public.customers(id) on delete restrict,
  lang             text not null default 'en' check (lang in ('en','es')),
  issue_date       date not null default current_date,
  valid_until      date,
  status           text not null default 'draft'
                   check (status in ('draft','sent','viewed','accepted','declined','paid','void')),
  notes            text not null default '',
  tax_rate         numeric(6,3) not null default 0 check (tax_rate >= 0 and tax_rate < 100),
  subtotal         numeric(12,2) not null default 0,
  tax              numeric(12,2) not null default 0,
  total            numeric(12,2) not null default 0,
  public_token     text not null unique default encode(gen_random_bytes(18), 'hex'),
  from_estimate_id uuid references public.documents(id) on delete set null,
  sent_at          timestamptz,
  viewed_at        timestamptz,
  accepted_at      timestamptz,
  accepted_name    text,
  declined_at      timestamptz,
  decline_reason   text,
  paid_at          timestamptz,
  payment_method   text,
  stripe_session_id text,
  created_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (business_id, number)
);
create index on public.documents (business_id, type, created_at desc);
create index on public.documents (customer_id);

create table public.document_items (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  service_id  uuid references public.services(id) on delete set null,
  name_en     text not null default '',
  name_es     text not null default '',
  qty         numeric(12,2) not null default 1 check (qty > 0),
  price       numeric(12,2) not null default 0 check (price >= 0),
  sort        int not null default 0
);
create index on public.document_items (document_id, sort);

-- historial: enviado por sms/email, visto, aceptado, pagado…
create table public.document_events (
  id          bigint generated always as identity primary key,
  document_id uuid not null references public.documents(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  kind        text not null,
  meta        jsonb not null default '{}'::jsonb,
  actor       uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index on public.document_events (document_id, created_at);

-- ---------- reglas de integridad ----------
-- número consecutivo por negocio y tipo (atómico)
create or replace function public.documents_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int; pfx text; days int;
begin
  if not exists (select 1 from public.customers c where c.id = new.customer_id and c.business_id = new.business_id) then
    raise exception 'customer does not belong to business';
  end if;
  if new.number is null or new.number = '' then
    if new.type = 'estimate' then
      update public.businesses set next_estimate = next_estimate + 1 where id = new.business_id
        returning next_estimate - 1, estimate_prefix, valid_days into n, pfx, days;
    else
      update public.businesses set next_invoice = next_invoice + 1 where id = new.business_id
        returning next_invoice - 1, invoice_prefix, valid_days into n, pfx, days;
    end if;
    new.number := pfx || n;
  else
    select valid_days into days from public.businesses where id = new.business_id;
  end if;
  if new.type = 'estimate' and new.valid_until is null then
    new.valid_until := new.issue_date + coalesce(days, 30);
  end if;
  new.created_by := coalesce(new.created_by, auth.uid());
  return new;
end $$;
create trigger documents_bi before insert on public.documents
  for each row execute function public.documents_before_insert();

-- no se puede mover un documento a otro negocio ni cambiar su número/token
create or replace function public.documents_before_update() returns trigger
language plpgsql as $$
begin
  if new.business_id <> old.business_id or new.public_token <> old.public_token
     or new.number is distinct from old.number or new.type <> old.type then
    raise exception 'immutable document fields';
  end if;
  if new.customer_id <> old.customer_id and not exists
     (select 1 from public.customers c where c.id = new.customer_id and c.business_id = new.business_id) then
    raise exception 'customer does not belong to business';
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger documents_bu before update on public.documents
  for each row execute function public.documents_before_update();

-- las partidas heredan el business_id de su documento (evita mezclar negocios)
create or replace function public.items_set_business() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  select business_id into new.business_id from public.documents where id = new.document_id;
  if new.business_id is null then raise exception 'document not found'; end if;
  return new;
end $$;
create trigger items_bi before insert or update on public.document_items
  for each row execute function public.items_set_business();

-- totales siempre calculados en la base de datos
create or replace function public.recalc_document(doc uuid) returns void
language plpgsql security definer set search_path = public as $$
declare s numeric(12,2); r numeric;
begin
  select coalesce(sum(round(qty * price, 2)), 0) into s from public.document_items where document_id = doc;
  select tax_rate into r from public.documents where id = doc;
  update public.documents
     set subtotal = s, tax = round(s * coalesce(r,0) / 100, 2), total = s + round(s * coalesce(r,0) / 100, 2)
   where id = doc;
end $$;
revoke execute on function public.recalc_document(uuid) from public, anon, authenticated;

create or replace function public.items_after_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op in ('UPDATE','DELETE') then perform public.recalc_document(old.document_id); end if;
  if tg_op in ('INSERT','UPDATE') then perform public.recalc_document(new.document_id); end if;
  return null;
end $$;
create trigger items_aiud after insert or update or delete on public.document_items
  for each row execute function public.items_after_change();

create or replace function public.documents_after_tax() returns trigger
language plpgsql security definer set search_path = public as $$
begin perform public.recalc_document(new.id); return null; end $$;
create trigger documents_au_tax after update of tax_rate on public.documents
  for each row when (old.tax_rate is distinct from new.tax_rate) execute function public.documents_after_tax();

-- el business_id de eventos se toma del documento
create or replace function public.events_set_business() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  select business_id into new.business_id from public.documents where id = new.document_id;
  new.actor := coalesce(new.actor, auth.uid());
  return new;
end $$;
create trigger events_bi before insert on public.document_events
  for each row execute function public.events_set_business();

-- un negocio siempre conserva al menos un dueño
create or replace function public.memberships_keep_owner() returns trigger
language plpgsql security definer set search_path = public as $$
declare bid uuid := coalesce(old.business_id, new.business_id);
begin
  if exists (select 1 from public.businesses where id = bid) and
     not exists (select 1 from public.memberships where business_id = bid and role = 'owner') then
    raise exception 'business must keep at least one owner';
  end if;
  return null;
end $$;
create constraint trigger memberships_owner_guard after update or delete on public.memberships
  deferrable initially immediate for each row execute function public.memberships_keep_owner();

-- ---------- Row Level Security ----------
alter table public.profiles        enable row level security;
alter table public.businesses      enable row level security;
alter table public.memberships     enable row level security;
alter table public.services        enable row level security;
alter table public.customers       enable row level security;
alter table public.documents       enable row level security;
alter table public.document_items  enable row level security;
alter table public.document_events enable row level security;

-- perfiles: el propio, los de compañeros de negocio, o superadmin
create policy profiles_select on public.profiles for select to authenticated using (
  id = auth.uid() or public.is_superadmin() or exists (
    select 1 from public.memberships a join public.memberships b on a.business_id = b.business_id
    where a.user_id = auth.uid() and b.user_id = profiles.id));
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
-- nadie puede hacerse superadmin ni cambiar su email desde el cliente
revoke update on public.profiles from authenticated, anon;
grant update (full_name, phone, ui_lang) on public.profiles to authenticated;

-- negocios
create policy businesses_select on public.businesses for select to authenticated
  using (public.is_superadmin() or exists (select 1 from public.memberships m where m.business_id = businesses.id and m.user_id = auth.uid()));
create policy businesses_update on public.businesses for update to authenticated
  using (public.has_role(id, array['owner','admin'])) with check (public.has_role(id, array['owner','admin']));
create policy businesses_insert on public.businesses for insert to authenticated with check (public.is_superadmin());
create policy businesses_delete on public.businesses for delete to authenticated using (public.is_superadmin());
-- campos que solo controla la plataforma (Stripe, activo, contadores)
revoke update on public.businesses from authenticated, anon;
grant update (name, owner_name, address1, address2, phone, email, website, tagline, logo_url, brand_color, accent_color,
              default_lang, tax_rate, valid_days, payment_text_en, payment_text_es, terms_est_en, terms_est_es,
              estimate_prefix, invoice_prefix) on public.businesses to authenticated;

-- membresías: ver las del propio negocio; administrarlas dueño/admin (reglas finas en el servidor)
create policy memberships_select on public.memberships for select to authenticated
  using (user_id = auth.uid() or public.has_role(business_id));
create policy memberships_write on public.memberships for all to authenticated
  using (public.has_role(business_id, array['owner','admin']) and (role <> 'owner' or public.has_role(business_id, array['owner'])))
  with check (public.has_role(business_id, array['owner','admin']) and (role <> 'owner' or public.has_role(business_id, array['owner'])));

-- catálogo: lo ven todos los miembros, lo editan dueño/admin
create policy services_select on public.services for select to authenticated using (public.has_role(business_id));
create policy services_insert on public.services for insert to authenticated with check (public.has_role(business_id, array['owner','admin']));
create policy services_update on public.services for update to authenticated
  using (public.has_role(business_id, array['owner','admin'])) with check (public.has_role(business_id, array['owner','admin']));
create policy services_delete on public.services for delete to authenticated using (public.has_role(business_id, array['owner','admin']));

create policy customers_rw on public.customers for all to authenticated
  using (public.has_role(business_id)) with check (public.has_role(business_id));

create policy documents_select on public.documents for select to authenticated using (public.has_role(business_id));
create policy documents_insert on public.documents for insert to authenticated with check (public.has_role(business_id));
create policy documents_update on public.documents for update to authenticated
  using (public.has_role(business_id)) with check (public.has_role(business_id));
create policy documents_delete on public.documents for delete to authenticated
  using (public.has_role(business_id, array['owner','admin']) or (status = 'draft' and public.has_role(business_id)));

create policy items_rw on public.document_items for all to authenticated
  using (public.has_role(business_id))
  with check (exists (select 1 from public.documents d where d.id = document_id and public.has_role(d.business_id)));

create policy events_select on public.document_events for select to authenticated using (public.has_role(business_id));
create policy events_insert on public.document_events for insert to authenticated
  with check (exists (select 1 from public.documents d where d.id = document_id and public.has_role(d.business_id)));

-- ---------- Storage: logos públicos, escritura solo dueño/admin ----------
insert into storage.buckets (id, name, public) values ('logos', 'logos', true) on conflict (id) do nothing;
create policy logos_read on storage.objects for select using (bucket_id = 'logos');
create policy logos_write on storage.objects for insert to authenticated
  with check (bucket_id = 'logos' and public.has_role(((storage.foldername(name))[1])::uuid, array['owner','admin']));
create policy logos_update on storage.objects for update to authenticated
  using (bucket_id = 'logos' and public.has_role(((storage.foldername(name))[1])::uuid, array['owner','admin']));
create policy logos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'logos' and public.has_role(((storage.foldername(name))[1])::uuid, array['owner','admin']));

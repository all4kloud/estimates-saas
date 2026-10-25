-- =====================================================================
--  Suscripción de la plataforma (Stripe Billing): cada negocio paga su plan.
--  Distinto de stripe_account_id (Connect), que es la cuenta donde el
--  negocio cobra a SUS clientes.
-- =====================================================================
alter table public.businesses
  add column billing_exempt         boolean not null default false,   -- cortesía / pilotos: sin cobro
  add column subscription_status    text    not null default 'none'
    check (subscription_status in ('none','incomplete','incomplete_expired','trialing','active',
                                   'past_due','canceled','unpaid','paused')),
  add column stripe_customer_id     text unique,
  add column stripe_subscription_id text unique,
  add column current_period_end     timestamptz,
  add column trial_end              timestamptz;

-- Los negocios que ya existen (pilotos) quedan sin cobro. Se cambia en /admin.
update public.businesses set billing_exempt = true;

-- Estos campos solo los escribe el servidor (webhook de Stripe / superadmin).
-- El grant de update de 0001 es por columna, así que el cliente no puede tocarlos.

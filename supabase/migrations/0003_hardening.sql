-- =====================================================================
--  Endurecimiento según el asesor de seguridad de Supabase:
--  - las funciones de trigger no deben poder llamarse por la API (/rest/v1/rpc)
--  - has_role / is_superadmin solo las necesita "authenticated" (las usan las políticas RLS)
--  - search_path fijo en documents_before_update
-- =====================================================================
alter function public.documents_before_update() set search_path = public;

revoke execute on function
  public.documents_after_tax(), public.documents_before_insert(), public.documents_before_update(),
  public.events_set_business(), public.handle_new_user(), public.handle_user_email_change(),
  public.items_after_change(), public.items_set_business(), public.memberships_keep_owner()
from public, anon, authenticated;

revoke execute on function public.has_role(uuid, text[]), public.is_superadmin() from public, anon;
grant execute on function public.has_role(uuid, text[]), public.is_superadmin() to authenticated, service_role;

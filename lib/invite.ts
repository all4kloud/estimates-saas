import 'server-only';
import { createAdminClient } from './supabase/server';
import { appUrl } from './format';
import type { Role } from './types';

/**
 * Invita (o reutiliza) un usuario por email y lo agrega al negocio con el rol indicado.
 * Usa service role: llamar SOLO después de verificar que quien invita tiene permiso.
 */
export async function inviteToBusiness(opts: { email: string; businessId: string; role: Role; fullName?: string }) {
  const admin = createAdminClient();
  const email = opts.email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Email');

  let userId: string | null = null;
  const { data: existing } = await admin.from('profiles').select('id').eq('email', email).maybeSingle();
  if (existing) userId = existing.id;
  else {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${appUrl()}/account/set-password`,
      data: { full_name: opts.fullName || '' },
    });
    if (error) throw new Error(error.message);
    userId = data.user.id;
  }

  const { error } = await admin.from('memberships').upsert(
    { business_id: opts.businessId, user_id: userId, role: opts.role },
    { onConflict: 'business_id,user_id' },
  );
  if (error) throw new Error(error.message);
  return { userId, existed: !!existing };
}

/** Reenvía el email (invitación si nunca entró, si no un link para crear contraseña). */
export async function resendAccess(email: string) {
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: `${appUrl()}/account/set-password` });
  if (error) {
    const { createClient } = await import('@supabase/supabase-js');
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
    const r = await anon.auth.resetPasswordForEmail(email, { redirectTo: `${appUrl()}/account/set-password` });
    if (r.error) throw new Error(r.error.message);
  }
}

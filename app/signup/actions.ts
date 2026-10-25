'use server';
import { randomBytes } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/server';
import { emailConfigured, sendPlatformEmail } from '@/lib/email';
import { appUrl, slugify } from '@/lib/format';
import { dict } from '@/lib/i18n/ui';
import type { FormState } from '@/components/ui';

/**
 * Registro por autoservicio: crea el usuario (sin confirmar), su negocio y la membresía de dueño,
 * y envía el email de confirmación. Al confirmar, el link lleva a /billing para activar el plan.
 * "Allow new users to sign up" sigue apagado en Supabase: el alta pasa solo por aquí.
 */
export async function signUp(_: FormState, fd: FormData): Promise<FormState> {
  const lang = fd.get('lang') === 'en' ? 'en' : 'es';
  const t = dict(lang);
  const s = (k: string, max = 120) => String(fd.get(k) || '').trim().slice(0, max);

  // trampa para bots: campo oculto que una persona no llena
  if (s('company_url')) return { ok: t.signupSent.replace('{email}', '') };

  const businessName = s('business');
  const fullName = s('full_name');
  const email = s('email', 200).toLowerCase();
  const password = String(fd.get('password') || '');
  if (!businessName || !fullName) return { error: t.needName };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: t.email };
  if (password.length < 8) return { error: t.pwShort };
  if (!emailConfigured()) return { error: t.emailNotConfigured };

  const admin = createAdminClient();
  const { data: existing } = await admin.from('profiles').select('id').eq('email', email).maybeSingle();
  if (existing) {
    // Un registro propio que nunca se confirmó se descarta y se empieza de nuevo.
    // Cualquier otro caso (usuario activo, o invitado a un equipo) ya tiene cuenta.
    const { data: u } = await admin.auth.admin.getUserById(existing.id);
    const stale = u?.user && !u.user.email_confirmed_at && u.user.user_metadata?.self_signup === true;
    if (!stale) return { error: t.signupExists };
    try {
      await discardStaleSignup(existing.id);
    } catch (e) {
      console.error('discardStaleSignup', e);
      return { error: t.error };
    }
  }

  // crea el usuario sin confirmar y devuelve el token del link de confirmación (no envía email)
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'signup', email, password, options: { data: { full_name: fullName, self_signup: true } },
  });
  if (linkErr || !link?.user) {
    const taken = /already|registered|exists/i.test(linkErr?.message || '');
    return { error: taken ? t.signupExists : linkErr?.message || t.error };
  }
  const userId = link.user.id;

  let businessId: string | null = null;
  try {
    // el perfil lo crea el trigger on_auth_user_created; aquí se completa
    await admin.from('profiles').update({ full_name: fullName, ui_lang: lang }).eq('id', userId);

    const slug = `${slugify(businessName) || 'biz'}`.slice(0, 33) + '-' + randomBytes(3).toString('hex');
    const { data: biz, error: bizErr } = await admin.from('businesses').insert({
      name: businessName, slug, owner_name: fullName, email, default_lang: 'en',
    }).select('id').single();
    if (bizErr) throw new Error(bizErr.message);
    businessId = biz.id;

    const { error: memErr } = await admin.from('memberships').insert({ business_id: biz.id, user_id: userId, role: 'owner' });
    if (memErr) throw new Error(memErr.message);

    const url = `${appUrl()}/auth/confirm?token_hash=${encodeURIComponent(link.properties.hashed_token)}&type=signup&next=/billing`;
    await sendPlatformEmail({
      to: email,
      subject: t.confirmSubject,
      text: t.confirmBody.replace('{name}', fullName).replace('{business}', businessName),
      button: { label: t.confirmBtn, url },
    });
  } catch (e) {
    // deshace todo para que la persona pueda intentar de nuevo con el mismo email
    console.error('signUp', e);
    if (businessId) await admin.from('businesses').delete().eq('id', businessId);
    await admin.auth.admin.deleteUser(userId);
    return { error: t.error };
  }

  return { ok: t.signupSent.replace('{email}', email) };
}

/** Borra un registro sin confirmar: sus negocios sin plan y sin otros miembros, y luego el usuario. */
async function discardStaleSignup(userId: string) {
  const admin = createAdminClient();
  const { data: owned } = await admin.from('memberships').select('business_id').eq('user_id', userId).eq('role', 'owner');
  for (const { business_id } of owned || []) {
    const { count } = await admin.from('memberships').select('user_id', { count: 'exact', head: true }).eq('business_id', business_id);
    if ((count ?? 0) <= 1) {
      // el negocio se borra antes que el usuario: un negocio no puede quedarse sin dueño
      await admin.from('businesses').delete().eq('id', business_id).eq('subscription_status', 'none');
    }
  }
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw new Error(error.message);
}

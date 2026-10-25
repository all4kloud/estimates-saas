'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCtx } from '@/lib/auth';
import { dict } from '@/lib/i18n/ui';
import type { FormState } from '@/components/ui';

export async function saveProfile(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await getCtx();
  if (!ctx) redirect('/login');
  const ui_lang = fd.get('ui_lang') === 'en' ? 'en' : 'es';
  const supabase = await createClient();
  const { error } = await supabase.from('profiles').update({
    full_name: String(fd.get('full_name') || '').trim().slice(0, 120),
    phone: String(fd.get('phone') || '').trim().slice(0, 40),
    ui_lang,
  }).eq('id', ctx.userId);
  revalidatePath('/', 'layout');
  return error ? { error: error.message } : { ok: dict(ui_lang).saved };
}

function checkNew(fd: FormData, t: ReturnType<typeof dict>): string | null {
  const pw = String(fd.get('new_password') || ''), pw2 = String(fd.get('confirm_password') || '');
  if (pw.length < 8) return t.pwShort;
  if (pw !== pw2) return t.pwMismatch;
  return null;
}

/** Cambio de contraseña desde "Mi cuenta": exige la contraseña actual. */
export async function changePassword(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await getCtx();
  if (!ctx) redirect('/login');
  const t = ctx.t;
  const err = checkNew(fd, t);
  if (err) return { error: err };
  const supabase = await createClient();
  const { error: authErr } = await supabase.auth.signInWithPassword({ email: ctx.profile.email, password: String(fd.get('current_password') || '') });
  if (authErr) return { error: t.pwWrong };
  const { error } = await supabase.auth.updateUser({ password: String(fd.get('new_password')) });
  return error ? { error: error.message } : { ok: t.passwordChanged };
}

/** Después de una invitación o "olvidé mi contraseña" (la sesión viene del link del email). */
export async function setPassword(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await getCtx();
  if (!ctx) redirect('/login');
  const err = checkNew(fd, ctx.t);
  if (err) return { error: err };
  const supabase = await createClient();
  const name = String(fd.get('full_name') || '').trim();
  const { error } = await supabase.auth.updateUser({ password: String(fd.get('new_password')) });
  if (error) return { error: error.message };
  if (name) await supabase.from('profiles').update({ full_name: name.slice(0, 120) }).eq('id', ctx.userId);
  redirect('/estimates');
}

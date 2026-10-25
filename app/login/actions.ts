'use server';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { appUrl } from '@/lib/format';
import { dict } from '@/lib/i18n/ui';
import type { FormState } from '@/components/ui';

export async function signIn(_: FormState, fd: FormData): Promise<FormState> {
  const t = dict(String(fd.get('lang')));
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(fd.get('email') || '').trim().toLowerCase(),
    password: String(fd.get('password') || ''),
  });
  if (error) return { error: t.badLogin };
  const next = String(fd.get('next') || '');
  redirect(next.startsWith('/') && !next.startsWith('//') && next !== '/' ? next : '/estimates');
}

export async function requestReset(_: FormState, fd: FormData): Promise<FormState> {
  const t = dict(String(fd.get('lang')));
  const email = String(fd.get('email') || '').trim().toLowerCase();
  if (email) {
    const supabase = await createClient();
    await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${appUrl()}/account/set-password` });
  }
  return { ok: t.forgotSent };   // misma respuesta exista o no el email
}

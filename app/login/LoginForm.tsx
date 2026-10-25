'use client';
import { useActionState } from 'react';
import Link from 'next/link';
import { signIn, requestReset } from './actions';
import { Alert, Submit } from '@/components/ui';
import type { Dict } from '@/lib/i18n/ui';

export function LoginForm({ t, lang, next }: { t: Dict; lang: string; next: string }) {
  const [state, action] = useActionState(signIn, null);
  return (
    <form action={action}>
      <Alert state={state} />
      <input type="hidden" name="lang" value={lang} />
      <input type="hidden" name="next" value={next} />
      <label className="f">{t.email}</label>
      <input className="in" name="email" type="email" autoComplete="email" inputMode="email" required />
      <label className="f">{t.password}</label>
      <input className="in" name="password" type="password" autoComplete="current-password" required />
      <div style={{ height: 14 }} />
      <Submit pendingText="…">{t.login}</Submit>
      <p className="small" style={{ textAlign: 'center', marginTop: 16 }}><Link href="/forgot-password">{t.forgot}</Link></p>
      <p className="small" style={{ textAlign: 'center', marginTop: 8 }}>{t.noAccount} <Link href={`/signup?lang=${lang}`}>{t.signup}</Link></p>
    </form>
  );
}

export function ForgotForm({ t, lang }: { t: Dict; lang: string }) {
  const [state, action] = useActionState(requestReset, null);
  return (
    <form action={action}>
      <Alert state={state} />
      <input type="hidden" name="lang" value={lang} />
      <label className="f">{t.email}</label>
      <input className="in" name="email" type="email" autoComplete="email" required />
      <div style={{ height: 14 }} />
      <Submit>{t.sendLink}</Submit>
      <p className="small" style={{ textAlign: 'center', marginTop: 16 }}><Link href="/login">{t.back}</Link></p>
    </form>
  );
}

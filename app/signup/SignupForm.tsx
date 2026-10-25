'use client';
import { useActionState } from 'react';
import Link from 'next/link';
import { signUp } from './actions';
import { Alert, Submit } from '@/components/ui';
import type { Dict } from '@/lib/i18n/ui';

export function SignupForm({ t, lang }: { t: Dict; lang: string }) {
  const [state, action] = useActionState(signUp, null);
  if (state?.ok) {
    return (
      <>
        <Alert state={state} />
        <p className="small" style={{ textAlign: 'center' }}><Link href="/login">{t.login}</Link></p>
      </>
    );
  }
  return (
    <form action={action}>
      <Alert state={state} />
      <input type="hidden" name="lang" value={lang} />
      {/* trampa para bots: oculta para personas */}
      <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
        <label>Company URL<input name="company_url" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <label className="f">{t.coName}</label>
      <input className="in" name="business" autoComplete="organization" required maxLength={120} />
      <label className="f">{t.fullName}</label>
      <input className="in" name="full_name" autoComplete="name" required maxLength={120} />
      <label className="f">{t.email}</label>
      <input className="in" name="email" type="email" autoComplete="email" inputMode="email" required />
      <label className="f">{t.password}</label>
      <input className="in" name="password" type="password" autoComplete="new-password" minLength={8} required />
      <p className="small muted" style={{ margin: '6px 0 0' }}>{t.pwShort}</p>
      <div style={{ height: 14 }} />
      <Submit pendingText="…">{t.signup}</Submit>
      <p className="small" style={{ textAlign: 'center', marginTop: 16 }}>{t.haveAccount} <Link href="/login">{t.login}</Link></p>
    </form>
  );
}

import { redirect } from 'next/navigation';
import { getCtx } from '@/lib/auth';
import { browserLang } from '@/lib/lang';
import { dict } from '@/lib/i18n/ui';
import { LoginForm } from './LoginForm';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getCtx()) redirect('/');
  const lang = await browserLang();
  const t = dict(lang);
  const { next = '/' } = await searchParams;
  return (
    <div className="auth-wrap">
      <div className="auth-card card">
        <img src="/icons/icon-192.png" alt="" width={56} height={56} style={{ borderRadius: 14, marginBottom: 12 }} />
        <h1>Estimates &amp; Invoices</h1>
        <p className="muted small" style={{ marginTop: 0 }}>{t.login}</p>
        <LoginForm t={t} lang={lang} next={next} />
      </div>
    </div>
  );
}

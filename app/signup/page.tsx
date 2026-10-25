import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCtx } from '@/lib/auth';
import { browserLang } from '@/lib/lang';
import { dict } from '@/lib/i18n/ui';
import { priceLabel, trialDays } from '@/lib/billing';
import { SignupForm } from './SignupForm';

export const dynamic = 'force-dynamic';

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  if (await getCtx()) redirect('/');
  const { lang: q } = await searchParams;
  const lang = q === 'en' || q === 'es' ? q : await browserLang();
  const t = dict(lang);
  const days = trialDays();
  const plan = (days ? t.planLine : t.planLineNoTrial).replace('{days}', String(days)).replace('{price}', priceLabel());
  return (
    <div className="auth-wrap">
      <div className="auth-card card">
        <img src="/icons/icon-192.png" alt="" width={56} height={56} style={{ borderRadius: 14, marginBottom: 12 }} />
        <h1>{t.signupTitle}</h1>
        <p className="muted small" style={{ marginTop: 0 }}>{plan}</p>
        <SignupForm t={t} lang={lang} />
        <p className="small" style={{ textAlign: 'center', marginTop: 8 }}>
          <Link href={`/signup?lang=${lang === 'es' ? 'en' : 'es'}`}>{lang === 'es' ? 'English' : 'Español'}</Link>
        </p>
      </div>
    </div>
  );
}

import { browserLang } from '@/lib/lang';
import { dict } from '@/lib/i18n/ui';
import { ForgotForm } from '../login/LoginForm';

export default async function ForgotPage() {
  const lang = await browserLang();
  const t = dict(lang);
  return (
    <div className="auth-wrap">
      <div className="auth-card card">
        <h1>{t.forgotTitle}</h1>
        <ForgotForm t={t} lang={lang} />
      </div>
    </div>
  );
}

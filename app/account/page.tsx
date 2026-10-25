import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCtx } from '@/lib/auth';
import { Icon } from '@/components/Icon';
import { PasswordForm, ProfileForm } from './AccountForms';

export default async function AccountPage() {
  const ctx = await getCtx();
  if (!ctx) redirect('/login');
  const { t } = ctx;
  return (
    <>
      <header className="topbar">
        <Link href="/" className="backlink" style={{ margin: 0 }}><Icon name="back" /> {t.back}</Link>
        <div className="topbar-title">{t.account}</div>
      </header>
      <main style={{ paddingBottom: 40 }}>
        <h3 style={{ marginTop: 4 }}>{t.profile}</h3>
        <ProfileForm t={t} p={ctx.profile} />
        <h3>{t.changePassword}</h3>
        <PasswordForm t={t} />
        <h3>{t.install}</h3>
        <div className="card small muted">{t.installHint}</div>
        <form action="/auth/signout" method="post" style={{ marginTop: 20 }}>
          <button className="btn danger block" type="submit"><Icon name="out" /> {t.signOut}</button>
        </form>
      </main>
    </>
  );
}

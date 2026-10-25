import Link from 'next/link';
import { requireBusiness } from '@/lib/auth';
import { Icon } from '@/components/Icon';

export default async function MorePage() {
  const ctx = await requireBusiness();
  const { t } = ctx;
  return (
    <>
      <h2>{ctx.business.name}</h2>
      <p className="small muted" style={{ marginTop: -6 }}>{ctx.profile.full_name || ctx.profile.email} · {ctx.role ? t[`role_${ctx.role}` as keyof typeof t] : 'superadmin'}</p>
      <div className="card menu" style={{ padding: 0 }}>
        {ctx.canManage && <Link href="/settings"><Icon name="gear" /> {t.settings}</Link>}
        {ctx.canManage && <Link href="/team"><Icon name="users" /> {t.team}</Link>}
        {ctx.isOwner && <Link href="/billing"><Icon name="inv" /> {t.billing}</Link>}
        <Link href="/account"><Icon name="user" /> {t.account}</Link>
        {ctx.isSuper && <Link href="/admin"><Icon name="shield" /> {t.admin}</Link>}
        <form action="/auth/signout" method="post"><button type="submit"><Icon name="out" /> {t.signOut}</button></form>
      </div>
      <h3>{t.install}</h3>
      <div className="card small muted">{t.installHint}</div>
    </>
  );
}

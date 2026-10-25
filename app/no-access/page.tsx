import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCtx } from '@/lib/auth';

export default async function NoAccess() {
  const ctx = await getCtx();
  if (!ctx) redirect('/login');
  if (ctx.business) redirect('/');
  return (
    <div className="auth-wrap">
      <div className="auth-card card">
        <h1>{ctx.t.noBusiness}</h1>
        <p className="muted">{ctx.t.noBusinessSub}</p>
        <p className="small muted">{ctx.profile.email}</p>
        <Link className="btn ghost block" href="/account">{ctx.t.account}</Link>
        <form action="/auth/signout" method="post" style={{ marginTop: 10 }}>
          <button className="btn danger block" type="submit">{ctx.t.signOut}</button>
        </form>
      </div>
    </div>
  );
}

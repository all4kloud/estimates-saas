import { redirect } from 'next/navigation';
import { getCtx } from '@/lib/auth';
import { SetPasswordForm } from '../AccountForms';

export default async function SetPasswordPage() {
  const ctx = await getCtx();
  if (!ctx) redirect('/login');
  return (
    <div className="auth-wrap">
      <div className="auth-card card">
        <h1>{ctx.t.setPassword}</h1>
        <p className="muted small" style={{ marginTop: 0 }}>{ctx.profile.email} · {ctx.t.setPasswordSub}</p>
        <SetPasswordForm t={ctx.t} name={ctx.profile.full_name} />
      </div>
    </div>
  );
}

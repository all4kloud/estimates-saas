'use client';
import { useActionState, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Submit, Toast } from '@/components/ui';
import { Icon } from '@/components/Icon';
import type { Dict } from '@/lib/i18n/ui';
import type { Role } from '@/lib/types';
import { changeRole, inviteMember, removeMember, resendInvite } from '../actions/team';

export function InviteForm({ t, canMakeOwner }: { t: Dict; canMakeOwner: boolean }) {
  const [state, action] = useActionState(inviteMember, null);
  return (
    <form action={action} className="card">
      <Alert state={state} />
      <label className="f">{t.email}</label>
      <input className="in" name="email" type="email" required />
      <label className="f">{t.fullName}</label>
      <input className="in" name="full_name" />
      <label className="f">{t.role}</label>
      <select className="in" name="role" defaultValue="member">
        <option value="member">{t.role_member}</option>
        <option value="admin">{t.role_admin}</option>
        {canMakeOwner && <option value="owner">{t.role_owner}</option>}
      </select>
      <div style={{ height: 12 }} />
      <Submit pendingText="…">{t.invite}</Submit>
    </form>
  );
}

export function MemberRow({ t, m, isSelf, canEdit, canMakeOwner }: {
  t: Dict; m: { id: string; email: string; full_name: string; role: Role }; isSelf: boolean; canEdit: boolean; canMakeOwner: boolean;
}) {
  const [pending, start] = useTransition();
  const [toast, setToast] = useState<string | null>(null);
  const router = useRouter();
  const run = (fn: () => Promise<unknown>, ok?: string) => start(async () => {
    try { await fn(); if (ok) setToast(ok); router.refresh(); } catch (e) { setToast(e instanceof Error ? e.message : t.error); }
  });
  return (
    <div className="member">
      <div className="grow">
        <b>{m.full_name || m.email}</b>{isSelf && <span className="small muted"> ({t.you})</span>}
        <div className="small muted">{m.email}</div>
      </div>
      {canEdit ? (
        <>
          <select className="in" style={{ width: 'auto', padding: '8px' }} value={m.role} disabled={pending}
            onChange={e => run(() => changeRole(m.id, e.target.value as Role), t.saved)}>
            <option value="member">{t.role_member}</option>
            <option value="admin">{t.role_admin}</option>
            {(canMakeOwner || m.role === 'owner') && <option value="owner">{t.role_owner}</option>}
          </select>
          <button className="btn ghost sm" title={t.resend} disabled={pending} onClick={() => run(() => resendInvite(m.email), t.inviteSent)}><Icon name="mail" /></button>
          <button className="btn danger sm" title={t.removeMember} disabled={pending}
            onClick={() => { if (confirm(t.confirmRemove)) run(() => removeMember(m.id)); }}><Icon name="x" /></button>
        </>
      ) : <span className="chip">{t[`role_${m.role}` as keyof Dict]}</span>}
      <Toast msg={toast} onDone={() => setToast(null)} />
    </div>
  );
}

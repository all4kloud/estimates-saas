'use client';
import { useActionState, useTransition } from 'react';
import { Alert, LangSeg, Submit } from '@/components/ui';
import { Icon } from '@/components/Icon';
import type { Dict } from '@/lib/i18n/ui';
import type { Customer, Lang } from '@/lib/types';
import { deleteCustomer, saveCustomer } from '../../actions/customers';

export function CustomerForm({ t, c, defaultLang }: { t: Dict; c: Customer | null; defaultLang: Lang }) {
  const [state, action] = useActionState(saveCustomer, null);
  return (
    <form action={action} className="card">
      <Alert state={state} />
      <input type="hidden" name="id" value={c?.id || ''} />
      <label className="f">{t.name} *</label>
      <input className="in" name="name" defaultValue={c?.name} required autoComplete="off" />
      <label className="f">{t.phone}</label>
      <input className="in" name="phone" type="tel" inputMode="tel" defaultValue={c?.phone} />
      <label className="f">{t.email}</label>
      <input className="in" name="email" type="email" inputMode="email" defaultValue={c?.email} />
      <label className="f">{t.address}</label>
      <input className="in" name="address" defaultValue={c?.address} />
      <label className="f">{t.customerLang}</label>
      <LangSeg name="lang" value={c?.lang || defaultLang} />
      <label className="f">{t.internalNotes}</label>
      <textarea className="in" name="notes" defaultValue={c?.notes} />
      <div style={{ height: 14 }} />
      <Submit pendingText={t.saving}>{t.save}</Submit>
    </form>
  );
}

export function DeleteCustomer({ t, id }: { t: Dict; id: string }) {
  const [pending, start] = useTransition();
  return (
    <button className="btn danger block" style={{ marginTop: 20 }} disabled={pending}
      onClick={() => { if (confirm(t.confirmDel)) start(() => deleteCustomer(id)); }}>
      <Icon name="trash" /> {t.del}
    </button>
  );
}

'use client';
import { useActionState, useTransition } from 'react';
import { Alert, LangSeg, Submit } from '@/components/ui';
import type { Dict } from '@/lib/i18n/ui';
import { createBusiness, enterBusiness, setActive, setExempt } from './actions';

export function BusinessRowActions({ t, id, active, exempt }: { t: Dict; id: string; active: boolean; exempt: boolean }) {
  const [pending, start] = useTransition();
  return (
    <div className="row" style={{ marginTop: 10, flexWrap: 'wrap' }}>
      <button className="btn sm grow" disabled={pending} onClick={() => start(() => enterBusiness(id))}>{t.enter}</button>
      <button className="btn sm grow ghost" disabled={pending} onClick={() => start(() => setExempt(id, !exempt))}>
        {exempt ? t.unmarkComp : t.markComp}</button>
      <button className={`btn sm grow ${active ? 'danger' : 'ghost'}`} disabled={pending} onClick={() => start(() => setActive(id, !active))}>
        {active ? t.deactivate : t.activate}</button>
    </div>
  );
}

export function NewBusinessForm({ t }: { t: Dict }) {
  const [state, action] = useActionState(createBusiness, null);
  return (
    <form action={action} className="card">
      <Alert state={state} />
      <label className="f">{t.coName} *</label><input className="in" name="name" required />
      <label className="f">{t.slug}</label><input className="in" name="slug" placeholder="power-washing" pattern="[a-z0-9-]{2,40}" />
      <label className="f">{t.ownerEmail} *</label><input className="in" name="owner_email" type="email" required />
      <label className="f">{t.ownerName}</label><input className="in" name="owner_name" />
      <label className="f">{t.phone}</label><input className="in" name="phone" type="tel" />
      <label className="f">{t.email}</label><input className="in" name="email" type="email" />
      <label className="f">{t.addr1}</label><input className="in" name="address1" />
      <label className="f">{t.addr2}</label><input className="in" name="address2" />
      <label className="f">{t.website}</label><input className="in" name="website" />
      <label className="f">{t.defaultLang}</label><LangSeg name="default_lang" value="en" />
      <label className="f">{t.initialServices}</label>
      <textarea className="in" name="services" rows={6} placeholder={'House exterior washing | Lavado exterior de vivienda | 350'} />
      <div style={{ height: 12 }} />
      <Submit pendingText="…">{t.create}</Submit>
    </form>
  );
}

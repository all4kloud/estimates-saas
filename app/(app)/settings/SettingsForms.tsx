'use client';
import { useActionState, useState } from 'react';
import { Alert, LangSeg, Submit } from '@/components/ui';
import { Icon } from '@/components/Icon';
import type { Dict } from '@/lib/i18n/ui';
import type { Business, Service } from '@/lib/types';
import { importV1, saveBusiness, saveServices, uploadLogo } from '../actions/business';

export function ServicesEditor({ t, initial }: { t: Dict; initial: Service[] }) {
  const [rows, setRows] = useState(initial.map(s => ({ id: s.id as string | undefined, name_en: s.name_en, name_es: s.name_es, price: String(Number(s.price) || '') })));
  const [state, action] = useActionState(saveServices, null);
  const set = (i: number, p: Partial<(typeof rows)[number]>) => setRows(rows.map((r, k) => (k === i ? { ...r, ...p } : r)));
  return (
    <form action={action} className="stack">
      <Alert state={state} />
      <input type="hidden" name="services" value={JSON.stringify(rows)} />
      {rows.map((r, i) => (
        <div key={r.id || `n${i}`} className="card svc-edit">
          <input className="in" placeholder={t.nameEn} value={r.name_en} onChange={e => set(i, { name_en: e.target.value })} />
          <input className="in" placeholder={t.nameEs} value={r.name_es} onChange={e => set(i, { name_es: e.target.value })} />
          <div className="row">
            <div className="money-in grow"><span>$</span>
              <input className="in" type="number" inputMode="decimal" step="0.01" placeholder={t.basePrice} value={r.price} onChange={e => set(i, { price: e.target.value })} /></div>
            <button className="btn danger sm" type="button" onClick={() => setRows(rows.filter((_, k) => k !== i))}>{t.remove}</button>
          </div>
        </div>
      ))}
      <button className="btn ghost block" type="button" onClick={() => setRows([...rows, { id: undefined, name_en: '', name_es: '', price: '' }])}>
        <Icon name="plus" /> {t.addService}</button>
      <Submit pendingText={t.saving}>{t.save}</Submit>
    </form>
  );
}

export function LogoForm({ t, url }: { t: Dict; url: string | null }) {
  const [state, action] = useActionState(uploadLogo, null);
  return (
    <form action={action} className="card">
      <Alert state={state} />
      {url && <img src={url} alt="" className="logo-prev" />}
      <label className="f">{t.uploadLogo}</label>
      <input className="in" type="file" name="logo" accept="image/png,image/jpeg" required />
      <div style={{ height: 10 }} />
      <Submit className="btn ghost block" pendingText={t.saving}>{t.save}</Submit>
    </form>
  );
}

export function BusinessForm({ t, b }: { t: Dict; b: Business }) {
  const [state, action] = useActionState(saveBusiness, null);
  const F = (name: keyof Business, label: string, type = 'text') => (
    <><label className="f">{label}</label><input className="in" name={name} type={type} step={type === 'number' ? 'any' : undefined} defaultValue={String(b[name] ?? '')} /></>
  );
  const A = (name: keyof Business, label: string) => (
    <><label className="f">{label}</label><textarea className="in" name={name} defaultValue={String(b[name] ?? '')} /></>
  );
  return (
    <form action={action}>
      <h3>{t.company}</h3>
      <div className="card">
        {F('name', t.coName)}{F('owner_name', t.owner)}{F('address1', t.addr1)}{F('address2', t.addr2)}
        {F('phone', t.phone, 'tel')}{F('email', t.email, 'email')}{F('website', t.website)}{F('tagline', t.tagline)}
        <label className="f">{t.brand}</label>
        <div className="row">
          <label className="row small muted"><input className="swatch" type="color" name="brand_color" defaultValue={b.brand_color} /> {t.brandColor}</label>
          <label className="row small muted"><input className="swatch" type="color" name="accent_color" defaultValue={b.accent_color} /> {t.accentColor}</label>
        </div>
      </div>
      <h3>{t.defaults}</h3>
      <div className="card">
        <label className="f">{t.defaultLang}</label>
        <LangSeg name="default_lang" value={b.default_lang} />
        <div className="row">
          <div className="grow">{F('tax_rate', t.taxRate, 'number')}</div>
          <div className="grow">{F('valid_days', t.validDays, 'number')}</div>
        </div>
        {A('payment_text_en', t.paymentEn)}{A('payment_text_es', t.paymentEs)}
        {A('terms_est_en', t.termsEn)}{A('terms_est_es', t.termsEs)}
        <div className="row">
          <div className="grow">{F('estimate_prefix', t.estPrefix)}</div>
          <div className="grow">{F('invoice_prefix', t.invPrefix)}</div>
        </div>
      </div>
      <div style={{ height: 12 }} />
      <Alert state={state} />
      <Submit pendingText={t.saving}>{t.save}</Submit>
    </form>
  );
}

export function ImportForm({ t }: { t: Dict }) {
  const [state, action] = useActionState(importV1, null);
  return (
    <form action={action} className="card">
      <Alert state={state} />
      <div className="small muted">{t.importV1Hint}</div>
      <input className="in" type="file" name="file" accept="application/json,.json" required style={{ marginTop: 8 }} />
      <div style={{ height: 10 }} />
      <Submit className="btn ghost block" pendingText={t.saving}>{t.importV1}</Submit>
    </form>
  );
}

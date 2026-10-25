'use client';
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/Icon';
import { Toast } from '@/components/ui';
import { fmtPhone, money, num } from '@/lib/format';
import type { Dict } from '@/lib/i18n/ui';
import type { Customer, DocType, Lang, Service } from '@/lib/types';
import { createCustomer, saveDocument, type DraftDoc, type DraftItem } from '../actions/documents';

type Item = DraftItem & { key: string };
const key = () => Math.random().toString(36).slice(2, 10);

export function DocEditor(props: {
  t: Dict; type: DocType; services: Service[]; customers: Customer[];
  initial?: DraftDoc & { number?: string }; defaults: { lang: Lang; tax_rate: number; date: string }; presetCustomer?: string;
}) {
  const { t, services } = props;
  const router = useRouter();
  const [pending, start] = useTransition();
  const [toast, setToast] = useState<string | null>(null);
  const [customers, setCustomers] = useState(props.customers);
  const init = props.initial;
  const preset = customers.find(c => c.id === props.presetCustomer);
  const [customerId, setCustomerId] = useState(init?.customer_id || preset?.id || '');
  const [lang, setLang] = useState<Lang>(init?.lang || preset?.lang || props.defaults.lang);
  const [items, setItems] = useState<Item[]>((init?.items || []).map(i => ({ ...i, key: key() })));
  const [notes, setNotes] = useState(init?.notes || '');
  const [tax, setTax] = useState(String(init?.tax_rate ?? props.defaults.tax_rate));
  const [date, setDate] = useState(init?.issue_date || props.defaults.date);
  const [cq, setCq] = useState('');
  const [newOpen, setNewOpen] = useState(false);
  const [nc, setNc] = useState({ name: '', phone: '', email: '', address: '', lang: 'en' as Lang });

  const customer = customers.find(c => c.id === customerId);
  const sub = items.reduce((a, i) => a + num(i.qty) * num(i.price), 0);
  const total = sub + Math.round(sub * num(tax)) / 100;
  const matches = useMemo(() => {
    const q = cq.toLowerCase();
    return customers.filter(c => !q || `${c.name} ${c.phone} ${c.email}`.toLowerCase().includes(q)).slice(0, 30);
  }, [cq, customers]);

  const toggleSvc = (s: Service) => {
    const has = items.find(i => i.service_id === s.id);
    if (has) setItems(items.filter(i => i !== has));
    else setItems([...items, { key: key(), service_id: s.id, name_en: s.name_en, name_es: s.name_es, qty: 1, price: Number(s.price) ? Number(s.price) : '' }]);
  };
  const patch = (k: string, p: Partial<Item>) => setItems(items.map(i => (i.key === k ? { ...i, ...p } : i)));

  const saveNewCustomer = () => start(async () => {
    const r = await createCustomer(nc);
    if (!r.ok) return setToast(r.error);
    setCustomers([...customers, r.data!]);
    setCustomerId(r.data!.id); setLang(r.data!.lang); setNewOpen(false);
    setNc({ name: '', phone: '', email: '', address: '', lang: 'en' });
  });

  const save = () => {
    if (!customerId) return setToast(t.needCustomer);
    if (!items.some(i => (i.name_en || i.name_es).trim())) return setToast(t.needItem);
    start(async () => {
      const r = await saveDocument({ id: init?.id, type: props.type, customer_id: customerId, lang, issue_date: date, notes, tax_rate: tax, items });
      if (!r.ok) return setToast(r.error);
      router.push(`/documents/${r.data}${items.some(i => !num(i.price)) ? '?warn=zero' : ''}`);
      router.refresh();
    });
  };

  return (
    <>
      <button className="backlink" type="button" onClick={() => router.back()}><Icon name="back" /> {t.back}</button>
      <h2>{init?.id ? `${t.edit} ${init.number || ''}` : props.type === 'estimate' ? t.newEstimate : t.newInvoice}</h2>

      <h3>{t.customer}</h3>
      {customer ? (
        <div className="card row">
          <div className="grow"><b>{customer.name}</b>
            <div className="small muted">{[fmtPhone(customer.phone), customer.email].filter(Boolean).join(' · ')}</div>
            {customer.address && <div className="small muted">{customer.address}</div>}</div>
          <button className="btn ghost sm" type="button" onClick={() => setCustomerId('')}>{t.change}</button>
        </div>
      ) : newOpen ? (
        <div className="card">
          <label className="f">{t.name} *</label>
          <input className="in" autoFocus value={nc.name} onChange={e => setNc({ ...nc, name: e.target.value })} autoComplete="off" />
          <label className="f">{t.phone}</label>
          <input className="in" type="tel" inputMode="tel" value={nc.phone} onChange={e => setNc({ ...nc, phone: e.target.value })} />
          <label className="f">{t.email}</label>
          <input className="in" type="email" inputMode="email" value={nc.email} onChange={e => setNc({ ...nc, email: e.target.value })} />
          <label className="f">{t.address}</label>
          <input className="in" value={nc.address} onChange={e => setNc({ ...nc, address: e.target.value })} />
          <label className="f">{t.customerLang}</label>
          <div className="seg">
            <button type="button" className={nc.lang === 'en' ? 'on' : ''} onClick={() => setNc({ ...nc, lang: 'en' })}>English</button>
            <button type="button" className={nc.lang === 'es' ? 'on' : ''} onClick={() => setNc({ ...nc, lang: 'es' })}>Español</button>
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn ghost grow" type="button" onClick={() => setNewOpen(false)}>{t.cancel}</button>
            <button className="btn teal grow" type="button" disabled={pending} onClick={saveNewCustomer}>{t.save}</button>
          </div>
        </div>
      ) : (
        <div className="card">
          <input className="in" placeholder={t.search} value={cq} onChange={e => setCq(e.target.value)} autoComplete="off" />
          <div className="client-pick">
            {matches.map(c => (
              <div key={c.id} className="client-opt" onClick={() => { setCustomerId(c.id); setLang(c.lang); }}>
                <b>{c.name}</b> <span className="small muted">{fmtPhone(c.phone)}</span>
              </div>
            ))}
          </div>
          <button className="btn ghost block" type="button" style={{ marginTop: 10 }} onClick={() => setNewOpen(true)}><Icon name="plus" /> {t.newCustomer}</button>
        </div>
      )}

      <h3>{t.docLang}</h3>
      <div className="seg">
        <button type="button" className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>English</button>
        <button type="button" className={lang === 'es' ? 'on' : ''} onClick={() => setLang('es')}>Español</button>
      </div>

      <h3>{t.services}</h3>
      <div className="stack">
        {services.map(s => {
          const it = items.find(i => i.service_id === s.id);
          return (
            <div key={s.id} className={`svc ${it ? 'on' : ''}`} onClick={e => { if (!(e.target as HTMLElement).closest('[data-stop]')) toggleSvc(s); }}>
              <div className="svc-head">
                <div className="tick">{it && <Icon name="check" />}</div>
                <div className="grow">
                  <div className="svc-name">{lang === 'es' ? s.name_es || s.name_en : s.name_en}</div>
                  <div className="svc-sub">{lang === 'es' ? s.name_en : s.name_es}{Number(s.price) ? ` · ${money(s.price)}` : ''}</div>
                </div>
              </div>
              {it && (
                <div className="svc-fields" data-stop>
                  <div><label>{t.qty}</label><input className="in" type="number" inputMode="decimal" min="0" step="any" value={it.qty} onChange={e => patch(it.key, { qty: e.target.value })} /></div>
                  <div><label>{t.price}</label><div className="money-in"><span>$</span>
                    <input className="in" type="number" inputMode="decimal" min="0" step="0.01" placeholder="0.00" autoFocus={!it.price}
                      value={it.price} onChange={e => patch(it.key, { price: e.target.value })} /></div></div>
                </div>
              )}
            </div>
          );
        })}
        {items.filter(i => !i.service_id || !services.some(s => s.id === i.service_id)).map(it => (
          <div key={it.key} className="svc on custom">
            <div className="row">
              <input className="in grow" placeholder={t.description} value={lang === 'es' ? it.name_es : it.name_en} autoFocus={!it.name_en}
                onChange={e => patch(it.key, { name_en: e.target.value, name_es: e.target.value })} />
              <button className="btn danger sm" type="button" aria-label={t.remove} onClick={() => setItems(items.filter(i => i.key !== it.key))}><Icon name="x" /></button>
            </div>
            <div className="svc-fields">
              <div><label>{t.qty}</label><input className="in" type="number" inputMode="decimal" step="any" value={it.qty} onChange={e => patch(it.key, { qty: e.target.value })} /></div>
              <div><label>{t.price}</label><div className="money-in"><span>$</span>
                <input className="in" type="number" inputMode="decimal" step="0.01" placeholder="0.00" value={it.price} onChange={e => patch(it.key, { price: e.target.value })} /></div></div>
            </div>
          </div>
        ))}
        <button className="btn ghost block" type="button" onClick={() => setItems([...items, { key: key(), service_id: null, name_en: '', name_es: '', qty: 1, price: '' }])}>
          <Icon name="plus" /> {t.addItem}
        </button>
      </div>

      <h3>{t.notes}</h3>
      <textarea className="in" value={notes} onChange={e => setNotes(e.target.value)} />
      <div className="row" style={{ marginTop: 6 }}>
        <div className="grow"><label className="f">{t.date}</label><input className="in" type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
        <div style={{ width: 110 }}><label className="f">{t.taxRate}</label><input className="in" type="number" inputMode="decimal" step="0.01" value={tax} onChange={e => setTax(e.target.value)} /></div>
      </div>
      <div className="pad-bottom" />
      <div className="sticky-total"><div className="inner">
        <div className="grow"><div className="small muted">{t.total}</div><div className="tot">{money(total)}</div></div>
        <button className="btn teal" type="button" disabled={pending} onClick={save}>{pending ? t.saving : t.saveView} <Icon name="arrow" /></button>
      </div></div>
      <Toast msg={toast} onDone={() => setToast(null)} />
    </>
  );
}

import { docDict } from '@/lib/i18n/doc';
import { fmtDate, fmtPhone, itemName, money, num } from '@/lib/format';
import type { Business, FullDoc } from '@/lib/types';

/** Vista del documento tal como la ve el cliente (misma estructura que el PDF). */
export function DocPreview({ doc, biz }: { doc: FullDoc; biz: Business }) {
  const L = docDict(doc.lang), c = doc.customer, isEst = doc.type === 'estimate';
  const payment = doc.lang === 'es' ? biz.payment_text_es : biz.payment_text_en;
  const terms = ((doc.lang === 'es' ? biz.terms_est_es : biz.terms_est_en) || '').replace('{days}', String(biz.valid_days));
  return (
    <div className="preview">
      <div className="pv-top">
        <div>
          {biz.logo_url ? <img src={biz.logo_url} alt={biz.name} /> : <div className="topbar-name" style={{ fontSize: 18 }}>{biz.name}</div>}
          <div className="pv-co">{[biz.address1, biz.address2, biz.phone, biz.email].filter(Boolean).map((l, i) => <div key={i}>{l}</div>)}</div>
        </div>
        <div>
          <div className="pv-title">{isEst ? L.estimate : L.invoice}</div>
          <div className="pv-meta">
            {L.no} <b>{doc.number}</b><br />{L.date}: {fmtDate(doc.issue_date, doc.lang)}<br />
            {isEst ? `${L.validUntil}: ${fmtDate(doc.valid_until, doc.lang)}` : `${L.due}: ${L.dueOnReceipt}`}
          </div>
          {!isEst && doc.status === 'paid' && <div className="right"><span className="paid-stamp">{L.paid}</span></div>}
        </div>
      </div>
      <div className="pv-bill">
        <div className="lbl">{isEst ? L.preparedFor : L.billTo}</div>
        <b>{c.name}</b>
        {c.address && <><br />{c.address}</>}{c.phone && <><br />{fmtPhone(c.phone)}</>}{c.email && <><br />{c.email}</>}
      </div>
      <table className="pv">
        <thead><tr><th>{L.desc}</th><th className="n">{L.qty}</th><th className="n">{L.price}</th><th className="n">{L.amount}</th></tr></thead>
        <tbody>{doc.items.map((i, k) => (
          <tr key={k}><td>{itemName(i, doc.lang)}</td><td className="n">{num(i.qty)}</td><td className="n">{money(i.price)}</td><td className="n">{money(num(i.qty) * num(i.price))}</td></tr>
        ))}</tbody>
      </table>
      <div className="pv-tot">
        <div><span>{L.subtotal}</span><span>{money(doc.subtotal)}</span></div>
        {Number(doc.tax) > 0 && <div><span>{L.tax} ({Number(doc.tax_rate)}%)</span><span>{money(doc.tax)}</span></div>}
        <div className="grand"><span>{isEst ? L.total : L.totalDue}</span><span>{money(doc.total)}</span></div>
      </div>
      {doc.notes && <div className="pv-block"><b>{L.notes}:</b> {doc.notes}</div>}
      {!isEst && payment && <div className="pv-block"><b>{L.payment}:</b> {payment}</div>}
      {isEst && terms && <div className="pv-block"><b>{L.terms}:</b> {terms}</div>}
      {isEst && doc.accepted_at && doc.accepted_name && (
        <div className="pv-block" style={{ color: 'var(--ok)', fontWeight: 700 }}>
          ✓ {L.acceptedOn.replace('{name}', doc.accepted_name).replace('{date}', fmtDate(doc.accepted_at, doc.lang))}
        </div>
      )}
      <div className="pv-foot">{L.thanks.toUpperCase()}
        {(biz.tagline || biz.website) && <><br /><span className="muted" style={{ fontWeight: 600, letterSpacing: '.5px' }}>
          {[biz.tagline, biz.website.replace(/^https?:\/\//, '').replace(/^www\./, '')].filter(Boolean).join(' · ').toUpperCase()}</span></>}
      </div>
    </div>
  );
}

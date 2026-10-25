import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireBusiness } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { emailContent, loadDoc, pdfFileName, smsBody } from '@/lib/docs';
import { emailConfigured } from '@/lib/email';
import { fmtDateTime, publicDocUrl } from '@/lib/format';
import { Icon } from '@/components/Icon';
import { DocPreview } from '@/components/DocPreview';
import type { DocEvent } from '@/lib/types';
import { DocActions, DocMoreActions, LangSwitch } from './DocActions';

export default async function DocPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ warn?: string }> }) {
  const ctx = await requireBusiness();
  const { t } = ctx;
  const { id } = await params;
  const { warn } = await searchParams;
  const supabase = await createClient();
  const doc = await loadDoc(supabase, { id });
  if (!doc || doc.business_id !== ctx.business.id) notFound();
  const biz = ctx.business;
  const [{ data: events }, { data: src }] = await Promise.all([
    supabase.from('document_events').select('*').eq('document_id', id).order('created_at', { ascending: false }).limit(30),
    doc.from_estimate_id ? supabase.from('documents').select('id, number').eq('id', doc.from_estimate_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const mail = emailContent(doc, biz);
  const isEst = doc.type === 'estimate';

  return (
    <>
      <Link href={isEst ? '/estimates' : '/invoices'} className="backlink"><Icon name="back" /> {isEst ? t.estimates : t.invoices}</Link>
      {warn === 'zero' && <div className="alert info">{t.zeroWarn}</div>}
      <div className="row" style={{ marginBottom: 10 }}>
        <h2 style={{ margin: 0 }}>{doc.number}</h2>
        <span className={`chip ${doc.status}`}>{t[doc.status as keyof typeof t]}</span>
        <div className="grow" />
        <LangSwitch id={doc.id} lang={doc.lang} />
      </div>
      {src && <div className="small muted" style={{ marginBottom: 8 }}>{t.fromEstimate} <Link href={`/documents/${src.id}`}>{src.number}</Link></div>}
      {doc.status === 'accepted' && doc.accepted_name && (
        <div className="alert ok">{t.acceptedBy} {doc.accepted_name} · {fmtDateTime(doc.accepted_at, ctx.profile.ui_lang)}</div>
      )}
      {doc.status === 'declined' && <div className="alert err">{t.declined}{doc.decline_reason ? ` · ${t.reason}: ${doc.decline_reason}` : ''}</div>}

      <DocActions t={t} id={doc.id} type={doc.type} status={doc.status} lang={doc.lang} number={doc.number} version={doc.updated_at}
        phone={doc.customer.phone} email={doc.customer.email} customerName={doc.customer.name} publicUrl={publicDocUrl(doc.public_token)}
        sms={smsBody(doc, biz)} mail={{ subject: mail.subject, text: mail.text }} pdfName={pdfFileName(doc)}
        canDelete={ctx.canManage || doc.status === 'draft'} emailReady={emailConfigured()} />

      <div style={{ marginTop: 14 }}><DocPreview doc={doc} biz={biz} /></div>
      <DocMoreActions t={t} id={doc.id} type={doc.type} canDelete={ctx.canManage || doc.status === 'draft'} />

      {!!events?.length && (
        <>
          <h3>{t.history}</h3>
          <ul className="card timeline">
            {(events as DocEvent[]).map(e => (
              <li key={e.id}>
                <span className="grow">{t[`ev_${e.kind}` as keyof typeof t] || e.kind}{e.kind === 'status' && e.meta?.status ? ` → ${t[e.meta.status as keyof typeof t]}` : ''}</span>
                <span className="when">{fmtDateTime(e.created_at, ctx.profile.ui_lang)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

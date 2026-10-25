import type { Metadata } from 'next';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { loadDoc } from '@/lib/docs';
import { docDict } from '@/lib/i18n/doc';
import { fmtDate, money, todayISO } from '@/lib/format';
import { stripe, stripeConfigured } from '@/lib/stripe';
import { markPaidFromSession } from '@/lib/payments';
import { DocPreview } from '@/components/DocPreview';
import type { Business, FullDoc, Lang } from '@/lib/types';
import { AcceptBox, PayButton } from './PublicActions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { robots: { index: false, follow: false } };

const valid = (t: string) => /^[a-f0-9]{36}$/.test(t);

export default async function PublicDoc({ params, searchParams }: {
  params: Promise<{ token: string }>; searchParams: Promise<{ lang?: string; paid?: string; session_id?: string }>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  const admin = createAdminClient();
  let doc: FullDoc | null = valid(token) ? await loadDoc(admin, { token }) : null;
  const { data: biz } = doc ? await admin.from('businesses').select('*').eq('id', doc.business_id).single<Business>() : { data: null };

  if (!doc || !biz || !biz.active) {
    return <div className="auth-wrap"><div className="auth-card card"><b>{docDict('en').notFound}</b><p className="muted">{docDict('es').notFound}</p></div></div>;
  }

  // vuelta desde Stripe: verificar el pago directamente (por si el webhook tarda)
  if (sp.paid && sp.session_id && biz.stripe_account_id && stripeConfigured() && doc.status !== 'paid') {
    try {
      const s = await stripe().checkout.sessions.retrieve(sp.session_id, {}, { stripeAccount: biz.stripe_account_id });
      if (s.metadata?.document_id === doc.id && (await markPaidFromSession(s))) doc = (await loadDoc(admin, { token }))!;
    } catch { /* el webhook lo confirmará */ }
  }

  // primera apertura por el cliente (no cuenta si lo abre alguien del negocio)
  const { data: { user } } = await (await createClient()).auth.getUser();
  const insider = user ? !!(await admin.from('memberships').select('user_id').eq('business_id', doc.business_id).eq('user_id', user.id).maybeSingle()).data : false;
  if (insider) { /* vista previa interna */ }
  else if (doc.status === 'sent') {
    await admin.from('documents').update({ status: 'viewed', viewed_at: new Date().toISOString() }).eq('id', doc.id).eq('status', 'sent');
    await admin.from('document_events').insert({ document_id: doc.id, kind: 'viewed' });
  } else if (!doc.viewed_at && doc.status !== 'draft') {
    await admin.from('documents').update({ viewed_at: new Date().toISOString() }).eq('id', doc.id);
  }

  const lang: Lang = sp.lang === 'es' || sp.lang === 'en' ? sp.lang : doc.lang;
  const view = { ...doc, lang };
  const L = docDict(lang);
  const isEst = doc.type === 'estimate';
  const expired = isEst && doc.valid_until && doc.valid_until < todayISO() && !['accepted', 'paid'].includes(doc.status);
  const canPay = !isEst && doc.status !== 'paid' && doc.status !== 'void' && biz.stripe_charges_enabled && stripeConfigured() && Number(doc.total) > 0;
  const brand = { ['--navy' as string]: biz.brand_color, ['--teal' as string]: biz.accent_color } as React.CSSProperties;

  return (
    <div style={brand} className="pub">
      <div className="row" style={{ marginBottom: 12 }}>
        <div className="grow small muted">{biz.name}</div>
        <a className="btn ghost sm" href={`?lang=${lang === 'es' ? 'en' : 'es'}`}>{L.switchLang}</a>
      </div>

      {doc.status === 'void' && <div className="alert err">{L.voided}</div>}
      {sp.paid && doc.status === 'paid' && <div className="alert ok">{L.thanksPaid}</div>}
      {!isEst && doc.status === 'paid' && !sp.paid && <div className="alert ok">{L.paidOn.replace('{date}', fmtDate(doc.paid_at, lang))}</div>}
      {isEst && doc.status === 'accepted' && <div className="alert ok">✓ {L.thanksAccept}</div>}
      {isEst && doc.status === 'declined' && <div className="alert err">{L.declinedOn.replace('{date}', fmtDate(doc.declined_at, lang))}</div>}
      {expired && doc.status !== 'declined' && <div className="alert info">{L.expired.replace('{date}', fmtDate(doc.valid_until, lang))}</div>}

      <DocPreview doc={view} biz={biz} />

      <div className="pub-actions stack">
        {isEst && !expired && ['sent', 'viewed', 'draft'].includes(doc.status) && <AcceptBox token={token} lang={lang} total={money(doc.total)} />}
        {canPay && <PayButton token={token} label={L.payCard.replace('{total}', money(doc.total))} busy={L.processing} />}
        <a className="btn ghost block" href={`/e/${token}/pdf?lang=${lang}`}>{L.downloadPdf}</a>
        {biz.phone && <div className="small muted" style={{ textAlign: 'center' }}>{L.questions} <a href={`tel:${biz.phone}`}>{biz.phone}</a></div>}
      </div>
    </div>
  );
}

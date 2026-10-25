'use client';
import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/Icon';
import { Toast } from '@/components/ui';
import { e164, fmtPhone } from '@/lib/format';
import type { Dict } from '@/lib/i18n/ui';
import type { DocStatus, DocType, Lang } from '@/lib/types';
import { convertToInvoice, deleteDocument, duplicateDocument, emailDocument, markSent, setLang, setStatus } from '../../actions/documents';

interface Props {
  t: Dict; id: string; type: DocType; status: DocStatus; lang: Lang; number: string; version: string;
  phone: string; email: string; customerName: string; publicUrl: string; sms: string;
  mail: { subject: string; text: string }; pdfName: string; canDelete: boolean; emailReady: boolean;
}

export function LangSwitch({ id, lang }: { id: string; lang: Lang }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const set = (l: Lang) => start(async () => { await setLang(id, l); router.refresh(); });
  return (
    <div className="seg" aria-busy={pending}>
      <button className={lang === 'en' ? 'on' : ''} onClick={() => set('en')}>EN</button>
      <button className={lang === 'es' ? 'on' : ''} onClick={() => set('es')}>ES</button>
    </div>
  );
}

export function DocActions(p: Props) {
  const { t } = p;
  const router = useRouter();
  const [pending, start] = useTransition();
  const [sheet, setSheet] = useState<null | 'text' | 'email'>(null);
  const [toast, setToast] = useState<string | null>(null);
  const pdf = useRef<File | null>(null);
  const isIOS = typeof navigator !== 'undefined' && (/iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

  // el PDF se descarga antes para que "Compartir" funcione al primer toque (iOS exige gesto inmediato)
  useEffect(() => {
    let alive = true;
    pdf.current = null;
    fetch(`/api/documents/${p.id}/pdf`).then(r => (r.ok ? r.blob() : null)).then(b => {
      if (alive && b) pdf.current = new File([b], p.pdfName, { type: 'application/pdf' });
    }).catch(() => {});
    return () => { alive = false; };
  }, [p.id, p.version, p.pdfName]);

  const run = (fn: () => Promise<unknown>, ok?: string) => start(async () => {
    try { await fn(); if (ok) setToast(ok); router.refresh(); }
    catch (e) { setToast(e instanceof Error ? e.message : t.error); }
  });

  const sendSms = () => {
    if (!p.phone) return setToast(t.noPhone);
    location.href = `sms:${e164(p.phone)}${isIOS ? '&' : '?'}body=${encodeURIComponent(p.sms)}`;
    markSent(p.id, 'sent_sms').then(() => router.refresh());
    setSheet(null);
  };
  const sharePdf = async () => {
    const f = pdf.current;
    setSheet(null);
    if (f && navigator.canShare?.({ files: [f] })) {
      try {
        await navigator.share({ files: [f], title: p.number, text: sheet === 'email' ? p.mail.text : p.sms });
        await markSent(p.id, 'shared_pdf'); router.refresh();
      } catch { /* cancelado */ }
    } else window.open(`/api/documents/${p.id}/pdf?download=1`, '_blank');
  };
  const mailApp = () => {
    if (!p.email) return setToast(t.noEmail);
    location.href = `mailto:${encodeURIComponent(p.email)}?subject=${encodeURIComponent(p.mail.subject)}&body=${encodeURIComponent(p.mail.text)}`;
    markSent(p.id, 'sent_email').then(() => router.refresh());
    setSheet(null);
  };
  const mailServer = () => {
    if (!p.email) return setToast(t.noEmail);
    setSheet(null);
    start(async () => {
      const r = await emailDocument(p.id);
      setToast(r.ok ? t.emailSent : r.error);
      router.refresh();
    });
  };
  const copy = async () => { try { await navigator.clipboard.writeText(p.publicUrl); setToast(t.linkCopied); } catch { setToast(p.publicUrl); } };

  const isEst = p.type === 'estimate';
  return (
    <>
      <div className="actions">
        <button className="btn teal" onClick={() => setSheet('text')} disabled={pending}><Icon name="msg" /> {t.sendText}</button>
        <button className="btn" onClick={() => setSheet('email')} disabled={pending}><Icon name="mail" /> {t.sendEmail}</button>
        {isEst ? (
          <>
            <button className="btn ghost" disabled={pending} onClick={() => run(() => setStatus(p.id, p.status === 'accepted' ? 'sent' : 'accepted'))}>
              <Icon name="check" /> {t.markAccepted}</button>
            <button className="btn ghost" disabled={pending} onClick={() => run(() => convertToInvoice(p.id))}><Icon name="arrow" /> {t.toInvoice}</button>
          </>
        ) : (
          <button className="btn ghost wide" disabled={pending} onClick={() => run(() => setStatus(p.id, p.status === 'paid' ? 'sent' : 'paid'))}>
            <Icon name="dollar" /> {p.status === 'paid' ? t.markUnpaid : t.markPaid}</button>
        )}
      </div>
      <div className="row" style={{ marginTop: 10, gap: 8 }}>
        <button className="btn ghost sm grow" onClick={copy}><Icon name="link" /> {t.copyLink}</button>
        <a className="btn ghost sm grow" href={p.publicUrl} target="_blank" rel="noreferrer"><Icon name="eye" /> {t.openPublic}</a>
      </div>

      {sheet && (
        <div className="sheet" onClick={e => { if (e.target === e.currentTarget) setSheet(null); }}>
          <div className="sheet-panel">
            <div className="row"><h4 className="grow">{sheet === 'text' ? t.sendText : t.sendEmail} · {p.number}</h4>
              <button className="btn ghost sm" onClick={() => setSheet(null)} aria-label={t.cancel}><Icon name="x" /></button></div>
            <div className="small muted">{p.customerName} · {sheet === 'text' ? fmtPhone(p.phone) || '—' : p.email || '—'} · {p.lang === 'es' ? 'Español' : 'English'}</div>
            {sheet === 'text' ? (
              <>
                <button className="opt" onClick={sendSms}><Icon name="msg" /><span><b>{t.sendText}</b><span className="small muted">{p.sms.slice(0, 90)}…</span></span></button>
                <button className="opt" onClick={sharePdf}><Icon name="share" /><span><b>{t.sharePdf}</b><span className="small muted">Messages · WhatsApp · Gmail…</span></span></button>
              </>
            ) : (
              <>
                {p.emailReady && <button className="opt" onClick={mailServer}><Icon name="mail" /><span><b>{t.sendEmail}</b><span className="small muted">PDF + link · {p.email}</span></span></button>}
                <button className="opt" onClick={mailApp}><Icon name="edit" /><span><b>Gmail / Mail</b><span className="small muted">{p.mail.subject}</span></span></button>
                <button className="opt" onClick={sharePdf}><Icon name="share" /><span><b>{t.sharePdf}</b><span className="small muted">PDF</span></span></button>
              </>
            )}
          </div>
        </div>
      )}
      <Toast msg={toast} onDone={() => setToast(null)} />
    </>
  );
}

export function DocMoreActions({ t, id, type, canDelete }: { t: Dict; id: string; type: DocType; canDelete: boolean }) {
  const [pending, start] = useTransition();
  return (
    <div className="actions" style={{ marginTop: 14 }}>
      <a className="btn ghost" href={`/api/documents/${id}/pdf?download=1`}><Icon name="dl" /> {t.downloadPdf}</a>
      <a className="btn ghost" href={`/documents/${id}/edit`}><Icon name="edit" /> {t.edit}</a>
      <button className="btn ghost" disabled={pending} onClick={() => start(() => duplicateDocument(id))}><Icon name="copy" /> {t.duplicate}</button>
      {canDelete && <button className="btn danger" disabled={pending} onClick={() => { if (confirm(t.confirmDel)) start(() => deleteDocument(id, type)); }}><Icon name="trash" /> {t.del}</button>}
    </div>
  );
}

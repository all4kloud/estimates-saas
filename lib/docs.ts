import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { docDict, type MsgData } from './i18n/doc';
import { fmtDate, itemName, money, num, publicDocUrl } from './format';
import type { Business, Customer, Doc, DocItem, FullDoc, Lang } from './types';

export async function loadDoc(sb: SupabaseClient, by: { id?: string; token?: string }): Promise<FullDoc | null> {
  let q = sb.from('documents').select('*, items:document_items(*), customer:customers(*)');
  q = by.id ? q.eq('id', by.id) : q.eq('public_token', by.token!);
  const { data } = await q.maybeSingle();
  if (!data) return null;
  const d = data as FullDoc;
  d.items = (d.items || []).sort((a: DocItem, b: DocItem) => a.sort - b.sort);
  return d;
}

export async function logEvent(sb: SupabaseClient, documentId: string, kind: string, meta: Record<string, unknown> = {}) {
  await sb.from('document_events').insert({ document_id: documentId, kind, meta });
}

export function msgData(doc: Doc & { items: DocItem[] }, customer: Customer, biz: Business, lang?: Lang): MsgData {
  const l = lang || doc.lang;
  const L = docDict(l);
  const lines = doc.items
    .map(i => `• ${itemName(i, l)}${num(i.qty) !== 1 ? ` (x${num(i.qty)})` : ''} – ${money(num(i.qty) * num(i.price))}`)
    .join('\n') + (Number(doc.tax) ? `\n• ${L.tax} (${Number(doc.tax_rate)}%) – ${money(doc.tax)}` : '');
  return {
    first: (customer.name || '').trim().split(/\s+/)[0] || '',
    owner: (biz.owner_name || '').trim().split(/\s+/)[0] || biz.name,
    co: biz.name,
    num: doc.number,
    items: doc.items.map(i => itemName(i, l)).join(', '),
    lines,
    total: money(doc.total),
    valid: fmtDate(doc.valid_until, l),
    payment: (l === 'es' ? biz.payment_text_es : biz.payment_text_en) || '',
    phone: biz.phone,
    link: publicDocUrl(doc.public_token),
  };
}

export function smsBody(doc: FullDoc, biz: Business) {
  const L = docDict(doc.lang);
  const d = msgData(doc, doc.customer, biz);
  return doc.type === 'estimate' ? L.smsEst(d) : L.smsInv(d);
}

export function emailContent(doc: FullDoc, biz: Business) {
  const L = docDict(doc.lang);
  const d = msgData(doc, doc.customer, biz);
  const isEst = doc.type === 'estimate';
  return { subject: isEst ? L.subjEst(d) : L.subjInv(d), text: isEst ? L.mailEst(d) : L.mailInv(d), link: d.link };
}

export function pdfFileName(doc: FullDoc) {
  const L = docDict(doc.lang);
  const who = (doc.customer?.name || '').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '');
  return `${L.file[doc.type]}-${doc.number}${who ? '-' + who : ''}.pdf`;
}

'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireBusiness } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { emailContent, loadDoc, logEvent, pdfFileName } from '@/lib/docs';
import { emailConfigured, sendEmail, simpleHtml } from '@/lib/email';
import { renderPdf } from '@/lib/pdf';
import { num, todayISO } from '@/lib/format';
import { docDict } from '@/lib/i18n/doc';
import type { Customer, DocStatus, DocType, Lang } from '@/lib/types';

export interface DraftItem { service_id: string | null; name_en: string; name_es: string; qty: number | string; price: number | string }
export interface DraftDoc {
  id?: string; type: DocType; customer_id: string; lang: Lang; issue_date: string; notes: string; tax_rate: number | string; items: DraftItem[];
}
type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

export async function createCustomer(input: Partial<Customer>): Promise<Result<Customer>> {
  const ctx = await requireBusiness();
  const name = String(input.name || '').trim();
  if (!name) return { ok: false, error: ctx.t.needName };
  const supabase = await createClient();
  const { data, error } = await supabase.from('customers').insert({
    business_id: ctx.business.id, name: name.slice(0, 160), phone: String(input.phone || '').slice(0, 40),
    email: String(input.email || '').trim().toLowerCase().slice(0, 160), address: String(input.address || '').slice(0, 240),
    lang: input.lang === 'es' ? 'es' : 'en',
  }).select('*').single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data as Customer };
}

export async function saveDocument(d: DraftDoc): Promise<Result<string>> {
  const ctx = await requireBusiness();
  const t = ctx.t;
  if (!d.customer_id) return { ok: false, error: t.needCustomer };
  const items = (d.items || [])
    .map((i, k) => ({ service_id: i.service_id || null, name_en: String(i.name_en || i.name_es || '').trim().slice(0, 300),
      name_es: String(i.name_es || i.name_en || '').trim().slice(0, 300), qty: num(i.qty) > 0 ? num(i.qty) : 1, price: Math.max(num(i.price), 0), sort: k }))
    .filter(i => i.name_en);
  if (!items.length) return { ok: false, error: t.needItem };
  const supabase = await createClient();
  const fields = {
    customer_id: d.customer_id, lang: d.lang === 'es' ? 'es' : 'en', issue_date: /^\d{4}-\d{2}-\d{2}$/.test(d.issue_date) ? d.issue_date : todayISO(),
    notes: String(d.notes || '').slice(0, 2000), tax_rate: Math.min(Math.max(num(d.tax_rate), 0), 99),
  };

  let id = d.id;
  if (id) {
    const { error } = await supabase.from('documents').update(fields).eq('id', id);
    if (error) return { ok: false, error: error.message };
    const { error: delErr } = await supabase.from('document_items').delete().eq('document_id', id);
    if (delErr) return { ok: false, error: delErr.message };
  } else {
    const { data, error } = await supabase.from('documents').insert({ ...fields, business_id: ctx.business.id, type: d.type === 'invoice' ? 'invoice' : 'estimate' })
      .select('id').single();
    if (error) return { ok: false, error: error.message };
    id = data.id as string;
    await logEvent(supabase, id, 'created');
  }
  const { error: itemErr } = await supabase.from('document_items').insert(items.map(i => ({ ...i, document_id: id })));
  if (itemErr) return { ok: false, error: itemErr.message };
  revalidatePath('/', 'layout');
  return { ok: true, data: id };
}

export async function setLang(id: string, lang: Lang) {
  await requireBusiness();
  const supabase = await createClient();
  await supabase.from('documents').update({ lang: lang === 'es' ? 'es' : 'en' }).eq('id', id);
  revalidatePath(`/documents/${id}`);
}

export async function setStatus(id: string, status: DocStatus) {
  await requireBusiness();
  const supabase = await createClient();
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status };
  if (status === 'paid') Object.assign(patch, { paid_at: now, payment_method: 'manual' });
  if (status === 'accepted') patch.accepted_at = now;
  if (status === 'declined') patch.declined_at = now;
  if (status === 'sent') Object.assign(patch, { paid_at: null, payment_method: null });
  await supabase.from('documents').update(patch).eq('id', id);
  await logEvent(supabase, id, status === 'paid' ? 'paid' : 'status', { status });
  revalidatePath('/', 'layout');
}

/** Registra que se envió (SMS desde el teléfono o PDF compartido) y pasa de borrador a enviado. */
export async function markSent(id: string, kind: 'sent_sms' | 'shared_pdf' | 'sent_email') {
  await requireBusiness();
  const supabase = await createClient();
  await supabase.from('documents').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', id).eq('status', 'draft');
  await supabase.from('documents').update({ sent_at: new Date().toISOString() }).eq('id', id).is('sent_at', null);
  await logEvent(supabase, id, kind);
  revalidatePath('/', 'layout');
}

export async function emailDocument(id: string): Promise<Result> {
  const ctx = await requireBusiness();
  if (!emailConfigured()) return { ok: false, error: ctx.t.emailNotConfigured };
  const supabase = await createClient();
  const doc = await loadDoc(supabase, { id });
  if (!doc) return { ok: false, error: ctx.t.error };
  if (!doc.customer.email) return { ok: false, error: ctx.t.noEmail };
  const biz = ctx.business;
  try {
    const pdf = await renderPdf(doc, biz);
    const m = emailContent(doc, biz);
    await sendEmail({
      biz, to: doc.customer.email, subject: m.subject, text: m.text,
      html: simpleHtml(m.text, biz, { label: docDict(doc.lang).viewOnline, url: m.link }),
      attachments: [{ filename: pdfFileName(doc), content: pdf }],
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : ctx.t.error };
  }
  await markSent(id, 'sent_email');
  return { ok: true };
}

export async function convertToInvoice(id: string) {
  const ctx = await requireBusiness();
  const supabase = await createClient();
  const est = await loadDoc(supabase, { id });
  if (!est || est.type !== 'estimate') return;
  const { data: inv, error } = await supabase.from('documents').insert({
    business_id: ctx.business.id, type: 'invoice', customer_id: est.customer_id, lang: est.lang, issue_date: todayISO(),
    notes: est.notes, tax_rate: est.tax_rate, from_estimate_id: est.id,
  }).select('id').single();
  if (error) throw new Error(error.message);
  await supabase.from('document_items').insert(est.items.map((i, k) => ({
    document_id: inv.id, service_id: i.service_id, name_en: i.name_en, name_es: i.name_es, qty: i.qty, price: i.price, sort: k,
  })));
  if (!['accepted', 'paid'].includes(est.status)) await supabase.from('documents').update({ status: 'accepted', accepted_at: new Date().toISOString() }).eq('id', est.id);
  await logEvent(supabase, est.id, 'converted', { invoice_id: inv.id });
  await logEvent(supabase, inv.id, 'created', { from: est.number });
  revalidatePath('/', 'layout');
  redirect(`/documents/${inv.id}`);
}

export async function duplicateDocument(id: string) {
  const ctx = await requireBusiness();
  const supabase = await createClient();
  const src = await loadDoc(supabase, { id });
  if (!src) return;
  const { data: copy, error } = await supabase.from('documents').insert({
    business_id: ctx.business.id, type: src.type, customer_id: src.customer_id, lang: src.lang, issue_date: todayISO(),
    notes: src.notes, tax_rate: src.tax_rate,
  }).select('id').single();
  if (error) throw new Error(error.message);
  await supabase.from('document_items').insert(src.items.map((i, k) => ({
    document_id: copy.id, service_id: i.service_id, name_en: i.name_en, name_es: i.name_es, qty: i.qty, price: i.price, sort: k,
  })));
  await logEvent(supabase, copy.id, 'created', { from: src.number });
  redirect(`/documents/${copy.id}/edit`);
}

export async function deleteDocument(id: string, type: DocType) {
  const ctx = await requireBusiness();
  const supabase = await createClient();
  const { error, count } = await supabase.from('documents').delete({ count: 'exact' }).eq('id', id);
  if (error || !count) throw new Error(error?.message || ctx.t.notAllowed);
  revalidatePath('/', 'layout');
  redirect(type === 'invoice' ? '/invoices' : '/estimates');
}

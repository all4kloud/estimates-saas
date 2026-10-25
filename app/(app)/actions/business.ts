'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { BID_COOKIE, getCtx, requireManager } from '@/lib/auth';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { num } from '@/lib/format';
import type { FormState } from '@/components/ui';

export async function switchBusiness(id: string) {
  const ctx = await getCtx();
  if (!ctx || !ctx.businesses.some(b => b.id === id)) return;
  (await cookies()).set(BID_COOKIE, id, { path: '/', httpOnly: true, sameSite: 'lax', secure: true, maxAge: 60 * 60 * 24 * 365 });
  redirect('/estimates');
}

const str = (fd: FormData, k: string, max = 500) => String(fd.get(k) ?? '').trim().slice(0, max);
const color = (v: string, fb: string) => (/^#[0-9a-f]{6}$/i.test(v) ? v : fb);

export async function saveBusiness(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireManager();
  const b = ctx.business;
  const supabase = await createClient();
  const { error } = await supabase.from('businesses').update({
    name: str(fd, 'name', 120) || b.name,
    owner_name: str(fd, 'owner_name', 120), address1: str(fd, 'address1', 160), address2: str(fd, 'address2', 160),
    phone: str(fd, 'phone', 40), email: str(fd, 'email', 160), website: str(fd, 'website', 160), tagline: str(fd, 'tagline', 120),
    brand_color: color(str(fd, 'brand_color'), b.brand_color), accent_color: color(str(fd, 'accent_color'), b.accent_color),
    default_lang: fd.get('default_lang') === 'es' ? 'es' : 'en',
    tax_rate: Math.min(Math.max(num(fd.get('tax_rate')), 0), 99), valid_days: Math.min(Math.max(Math.round(num(fd.get('valid_days'))) || 30, 1), 365),
    payment_text_en: str(fd, 'payment_text_en', 1000), payment_text_es: str(fd, 'payment_text_es', 1000),
    terms_est_en: str(fd, 'terms_est_en', 2000), terms_est_es: str(fd, 'terms_est_es', 2000),
    estimate_prefix: str(fd, 'estimate_prefix', 10) || 'E-', invoice_prefix: str(fd, 'invoice_prefix', 10) || 'INV-',
  }).eq('id', b.id);
  revalidatePath('/', 'layout');
  return error ? { error: error.message } : { ok: ctx.t.saved };
}

export async function uploadLogo(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireManager();
  const file = fd.get('logo');
  if (!(file instanceof File) || !file.size) return { error: ctx.t.uploadLogo };
  if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 2_000_000) return { error: 'PNG/JPG < 2 MB' };
  const supabase = await createClient();
  const ext = file.type === 'image/png' ? 'png' : 'jpg';
  const path = `${ctx.business.id}/logo-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('logos').upload(path, file, { contentType: file.type, upsert: true });
  if (error) return { error: error.message };
  const { data } = supabase.storage.from('logos').getPublicUrl(path);
  await supabase.from('businesses').update({ logo_url: data.publicUrl }).eq('id', ctx.business.id);
  revalidatePath('/', 'layout');
  return { ok: ctx.t.saved };
}

/** Guarda el catálogo completo (llega como JSON desde el editor de servicios). */
export async function saveServices(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireManager();
  const supabase = await createClient();
  let rows: { id?: string; name_en: string; name_es: string; price: number }[] = [];
  try { rows = JSON.parse(String(fd.get('services') || '[]')); } catch { return { error: ctx.t.error }; }
  rows = rows.filter(r => (r.name_en || r.name_es || '').trim()).slice(0, 200);

  const { data: existing } = await supabase.from('services').select('id').eq('business_id', ctx.business.id);
  const keep = new Set(rows.filter(r => r.id).map(r => r.id));
  const gone = (existing || []).map(s => s.id).filter(id => !keep.has(id));
  if (gone.length) await supabase.from('services').update({ active: false }).in('id', gone);   // conserva el historial

  for (const [i, r] of rows.entries()) {
    const v = { name_en: (r.name_en || r.name_es).trim().slice(0, 160), name_es: (r.name_es || '').trim().slice(0, 160), price: Math.max(num(r.price), 0), sort: i, active: true };
    const { error } = r.id
      ? await supabase.from('services').update(v).eq('id', r.id).eq('business_id', ctx.business.id)
      : await supabase.from('services').insert({ ...v, business_id: ctx.business.id });
    if (error) return { error: error.message };
  }
  revalidatePath('/settings');
  return { ok: ctx.t.saved };
}

// ---------- importar respaldo de la v1 (PWA sin servidor) ----------
interface V1 {
  settings?: { services?: { en: string; es: string; price: number }[] };
  clients?: { id: string; name: string; phone?: string; email?: string; address?: string; lang?: string }[];
  docs?: { id: string; type: 'estimate' | 'invoice'; number: string; clientId: string; lang?: string; date?: string; status?: string;
           notes?: string; taxRate?: number; fromEstimateId?: string; items: { en?: string; es?: string; qty: number; price: number }[] }[];
}

export async function importV1(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireManager();
  const file = fd.get('file');
  if (!(file instanceof File) || !file.size) return { error: ctx.t.importV1Hint };
  let data: V1;
  try { data = JSON.parse(await file.text()); } catch { return { error: 'JSON' }; }
  if (!Array.isArray(data.docs) || !Array.isArray(data.clients)) return { error: 'JSON' };

  const supabase = await createClient();
  const bid = ctx.business.id;
  const lang = (l?: string) => (l === 'es' ? 'es' : 'en');

  // servicios (solo los que no existan por nombre)
  const { data: svcs } = await supabase.from('services').select('name_en').eq('business_id', bid);
  const have = new Set((svcs || []).map(s => s.name_en.toLowerCase()));
  const newSvcs = (data.settings?.services || []).filter(s => s.en && !have.has(s.en.toLowerCase()))
    .map((s, i) => ({ business_id: bid, name_en: s.en, name_es: s.es || '', price: Math.max(num(s.price), 0), sort: 100 + i }));
  if (newSvcs.length) await supabase.from('services').insert(newSvcs);
  // precios base de la v1 para servicios existentes con precio 0
  for (const s of data.settings?.services || []) {
    if (s.en && num(s.price) > 0) await supabase.from('services').update({ price: num(s.price) }).eq('business_id', bid).ilike('name_en', s.en).eq('price', 0);
  }

  const cmap = new Map<string, string>();
  for (const c of data.clients) {
    const { data: row, error } = await supabase.from('customers').insert({
      business_id: bid, name: (c.name || '—').slice(0, 160), phone: c.phone || '', email: c.email || '', address: c.address || '', lang: lang(c.lang),
    }).select('id').single();
    if (error) return { error: error.message };
    cmap.set(c.id, row.id);
  }

  const { data: taken } = await supabase.from('documents').select('number').eq('business_id', bid);
  const used = new Set((taken || []).map(d => d.number));
  const dmap = new Map<string, string>();
  const maxN = { estimate: 0, invoice: 0 };
  const okStatus = ['draft', 'sent', 'accepted', 'declined', 'paid'];
  // primero estimados, para poder enlazar facturas convertidas
  const docs = [...data.docs].sort((a, b) => (a.type === b.type ? 0 : a.type === 'estimate' ? -1 : 1));
  for (const d of docs) {
    const customer_id = cmap.get(d.clientId);
    if (!customer_id || !d.items?.length) continue;
    const number = used.has(d.number) ? `${d.number}-v1` : d.number;
    used.add(number);
    const n = parseInt(String(d.number).replace(/\D/g, ''), 10);
    if (n > maxN[d.type]) maxN[d.type] = n;
    const { data: row, error } = await supabase.from('documents').insert({
      business_id: bid, type: d.type, number, customer_id, lang: lang(d.lang), issue_date: d.date || undefined,
      status: okStatus.includes(d.status || '') ? d.status : 'draft', notes: d.notes || '', tax_rate: Math.max(num(d.taxRate), 0),
      from_estimate_id: d.fromEstimateId ? dmap.get(d.fromEstimateId) ?? null : null,
    }).select('id').single();
    if (error) return { error: error.message };
    dmap.set(d.id, row.id);
    const items = d.items.map((i, k) => ({ document_id: row.id, name_en: i.en || i.es || '', name_es: i.es || i.en || '', qty: num(i.qty) || 1, price: Math.max(num(i.price), 0), sort: k }));
    const { error: e2 } = await supabase.from('document_items').insert(items);
    if (e2) return { error: e2.message };
  }

  // que la numeración nueva continúe después de lo importado (columnas reservadas → service role)
  const admin = createAdminClient();
  const { data: biz } = await admin.from('businesses').select('next_estimate, next_invoice').eq('id', bid).single();
  if (biz) await admin.from('businesses').update({
    next_estimate: Math.max(biz.next_estimate, maxN.estimate + 1), next_invoice: Math.max(biz.next_invoice, maxN.invoice + 1),
  }).eq('id', bid);

  revalidatePath('/', 'layout');
  return { ok: `${ctx.t.importDone}: ${cmap.size} ${ctx.t.customers.toLowerCase()}, ${dmap.size} docs` };
}

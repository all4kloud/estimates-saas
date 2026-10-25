'use server';
import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';
import { notifyBusiness } from '@/lib/email';
import { docDict } from '@/lib/i18n/doc';
import type { Business } from '@/lib/types';

// Acciones del CLIENTE final (sin sesión). El token largo y aleatorio es la credencial.
async function load(token: string) {
  if (!/^[a-f0-9]{36}$/.test(token)) return null;
  const admin = createAdminClient();
  const { data: doc } = await admin.from('documents').select('id, type, status, number, lang, business_id').eq('public_token', token).maybeSingle();
  if (!doc) return null;
  const { data: biz } = await admin.from('businesses').select('*').eq('id', doc.business_id).single<Business>();
  if (!biz?.active) return null;
  return { admin, doc, biz };
}

export async function acceptEstimate(token: string, name: string): Promise<{ ok: boolean }> {
  const r = await load(token);
  const clean = name.trim().replace(/\s+/g, ' ').slice(0, 120);
  if (!r || r.doc.type !== 'estimate' || clean.length < 2 || ['accepted', 'declined', 'void', 'paid'].includes(r.doc.status)) return { ok: false };
  await r.admin.from('documents').update({ status: 'accepted', accepted_at: new Date().toISOString(), accepted_name: clean }).eq('id', r.doc.id);
  await r.admin.from('document_events').insert({ document_id: r.doc.id, kind: 'accepted', meta: { name: clean } });
  const msg = docDict(r.biz.default_lang).notifyAccepted(r.doc.number, clean);
  await notifyBusiness(r.biz, msg, msg);
  revalidatePath(`/e/${token}`);
  return { ok: true };
}

export async function declineEstimate(token: string, reason: string): Promise<{ ok: boolean }> {
  const r = await load(token);
  if (!r || r.doc.type !== 'estimate' || ['accepted', 'declined', 'void', 'paid'].includes(r.doc.status)) return { ok: false };
  const why = reason.trim().slice(0, 500);
  await r.admin.from('documents').update({ status: 'declined', declined_at: new Date().toISOString(), decline_reason: why || null }).eq('id', r.doc.id);
  await r.admin.from('document_events').insert({ document_id: r.doc.id, kind: 'declined', meta: why ? { reason: why } : {} });
  const msg = docDict(r.biz.default_lang).notifyDeclined(r.doc.number);
  await notifyBusiness(r.biz, msg, why ? `${msg}: ${why}` : msg);
  revalidatePath(`/e/${token}`);
  return { ok: true };
}

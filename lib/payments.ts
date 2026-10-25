import 'server-only';
import type Stripe from 'stripe';
import { createAdminClient } from './supabase/server';
import { notifyBusiness } from './email';
import { docDict } from './i18n/doc';
import { money } from './format';
import type { Business } from './types';

/** Marca la factura como pagada a partir de una sesión de Checkout ya verificada. Idempotente. */
export async function markPaidFromSession(session: Stripe.Checkout.Session) {
  const docId = session.metadata?.document_id;
  if (!docId || session.payment_status !== 'paid') return false;
  const admin = createAdminClient();
  const { data: updated } = await admin.from('documents')
    .update({ status: 'paid', paid_at: new Date().toISOString(), payment_method: 'card', stripe_session_id: session.id })
    .eq('id', docId).neq('status', 'paid').select('id, number, lang, total, business_id').maybeSingle();
  if (!updated) return true;   // ya estaba pagada
  await admin.from('document_events').insert({ document_id: docId, kind: 'paid_card', meta: { session: session.id, amount: session.amount_total } });
  const { data: biz } = await admin.from('businesses').select('*').eq('id', updated.business_id).single<Business>();
  if (biz) {
    const L = docDict(biz.default_lang);
    const msg = L.notifyPaid(updated.number, money(updated.total));
    await notifyBusiness(biz, msg, msg);
  }
  return true;
}

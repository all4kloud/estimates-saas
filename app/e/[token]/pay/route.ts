import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { platformFee, stripe, stripeConfigured } from '@/lib/stripe';
import { appUrl } from '@/lib/format';
import { docDict } from '@/lib/i18n/doc';
import type { Business } from '@/lib/types';

// Crea un Checkout de Stripe en la cuenta conectada del negocio y redirige al cliente.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const back = `${appUrl()}/e/${token}`;
  if (!/^[a-f0-9]{36}$/.test(token) || !stripeConfigured()) return NextResponse.redirect(back, 303);
  const admin = createAdminClient();
  const { data: doc } = await admin.from('documents')
    .select('id, type, status, number, total, lang, business_id, customer:customers(email)').eq('public_token', token).maybeSingle();
  if (!doc || doc.type !== 'invoice' || ['paid', 'void'].includes(doc.status) || Number(doc.total) <= 0) return NextResponse.redirect(back, 303);
  const { data: biz } = await admin.from('businesses').select('*').eq('id', doc.business_id).single<Business>();
  if (!biz?.active || !biz.stripe_account_id || !biz.stripe_charges_enabled) return NextResponse.redirect(back, 303);

  const cents = Math.round(Number(doc.total) * 100);
  const fee = platformFee(cents);
  const email = (doc.customer as unknown as { email: string } | null)?.email || undefined;
  const L = docDict(doc.lang);
  const session = await stripe().checkout.sessions.create({
    mode: 'payment',
    locale: doc.lang === 'es' ? 'es' : 'en',
    customer_email: email,
    line_items: [{ quantity: 1, price_data: { currency: 'usd', unit_amount: cents, product_data: { name: `${L.file.invoice} ${doc.number} – ${biz.name}` } } }],
    payment_intent_data: { description: `${biz.name} ${doc.number}`, metadata: { document_id: doc.id }, ...(fee ? { application_fee_amount: fee } : {}) },
    metadata: { document_id: doc.id, business_id: biz.id },
    success_url: `${back}?paid=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: back,
  }, { stripeAccount: biz.stripe_account_id });
  return NextResponse.redirect(session.url!, 303);
}

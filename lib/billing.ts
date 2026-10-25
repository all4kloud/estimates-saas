import 'server-only';
import { stripe } from './stripe';
import { env } from './env';
import { createAdminClient } from './supabase/server';
import type { Business, SubStatus } from './types';

/** Estados con acceso a la app. past_due sigue entrando mientras Stripe reintenta el cobro. */
const OK: SubStatus[] = ['trialing', 'active', 'past_due'];

export const billingOk = (b: Pick<Business, 'billing_exempt' | 'subscription_status'>) =>
  b.billing_exempt || OK.includes(b.subscription_status);

export const billingConfigured = () => !!env('STRIPE_SECRET_KEY') && !!env('STRIPE_PRICE_ID');
export const trialDays = () => Math.max(0, Math.min(90, Number(env('TRIAL_DAYS') ?? 14) || 0));
export const priceLabel = () => env('PLAN_PRICE_LABEL') || '$100';

const ts = (s: number | null | undefined) => (s ? new Date(s * 1000).toISOString() : null);

/**
 * Copia el estado de una suscripción de Stripe al negocio. Siempre vuelve a leer la
 * suscripción desde Stripe, así no importa si los webhooks llegan desordenados.
 */
export async function syncSubscription(subscriptionId: string) {
  const sub = await stripe().subscriptions.retrieve(subscriptionId);
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  const admin = createAdminClient();

  let q = admin.from('businesses').select('id, stripe_subscription_id');
  q = sub.metadata?.business_id ? q.eq('id', sub.metadata.business_id) : q.eq('stripe_customer_id', customerId);
  const { data: biz } = await q.maybeSingle();
  if (!biz) {
    console.warn('syncSubscription: negocio no encontrado', sub.id, customerId);
    return null;
  }

  // Una suscripción vieja que termina no debe pisar a la nueva.
  const ended = sub.status === 'canceled' || sub.status === 'incomplete_expired';
  if (ended && biz.stripe_subscription_id && biz.stripe_subscription_id !== sub.id) return biz.id as string;

  // desde la API 2025-03-31 el fin de periodo vive en cada item de la suscripción
  const periodEnd = Math.max(0, ...sub.items.data.map(it => it.current_period_end ?? 0)) || null;
  const { error } = await admin.from('businesses').update({
    stripe_customer_id: customerId,
    stripe_subscription_id: sub.id,
    subscription_status: sub.status as SubStatus,
    current_period_end: ts(periodEnd),
    trial_end: ts(sub.trial_end),
  }).eq('id', biz.id);
  if (error) throw new Error(error.message);
  return biz.id as string;
}

/** Al volver de Checkout: confirma la sesión (si es de este negocio) sin esperar al webhook. */
export async function syncFromCheckoutSession(sessionId: string, businessId: string) {
  const session = await stripe().checkout.sessions.retrieve(sessionId);
  if (session.mode !== 'subscription' || session.metadata?.business_id !== businessId || !session.subscription) return false;
  const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
  await syncSubscription(subId);
  return true;
}

/** Cliente de Stripe del negocio (lo crea la primera vez). */
export async function ensureCustomer(b: Business, fallbackEmail: string) {
  if (b.stripe_customer_id) return b.stripe_customer_id;
  const c = await stripe().customers.create({
    email: b.email || fallbackEmail,
    name: b.name,
    metadata: { business_id: b.id },
  });
  await createAdminClient().from('businesses').update({ stripe_customer_id: c.id }).eq('id', b.id);
  return c.id;
}

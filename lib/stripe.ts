import 'server-only';
import Stripe from 'stripe';
import { env } from './env';

let _stripe: Stripe | null = null;
export const stripeConfigured = () => !!env('STRIPE_SECRET_KEY');
export function stripe() {
  const key = env('STRIPE_SECRET_KEY');
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
  if (!_stripe) _stripe = new Stripe(key);
  return _stripe;
}

/** Comisión opcional de la plataforma, en centavos. */
export function platformFee(amountCents: number) {
  const pct = Number(env('PLATFORM_FEE_PERCENT') || 0);
  return pct > 0 ? Math.round((amountCents * pct) / 100) : 0;
}

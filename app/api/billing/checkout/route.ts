import { NextResponse } from 'next/server';
import { getCtx } from '@/lib/auth';
import { stripe } from '@/lib/stripe';
import { env } from '@/lib/env';
import { billingConfigured, billingOk, ensureCustomer, trialDays } from '@/lib/billing';
import { appUrl } from '@/lib/format';

// Abre Stripe Checkout para suscribir el negocio activo al plan. Solo el dueño (o superadmin).
export async function POST() {
  const ctx = await getCtx();
  const billing = `${appUrl()}/billing`;
  if (!ctx) return NextResponse.redirect(`${appUrl()}/login`, 303);
  const b = ctx.business;
  if (!b || !ctx.isOwner || !billingConfigured()) return NextResponse.redirect(billing, 303);
  if (billingOk(b) && !b.billing_exempt) return NextResponse.redirect(billing, 303);   // ya tiene plan

  const customer = await ensureCustomer(b, ctx.profile.email);
  // la prueba gratis es solo para negocios que nunca tuvieron suscripción
  const trial = b.subscription_status === 'none' && !b.stripe_subscription_id ? trialDays() : 0;

  const session = await stripe().checkout.sessions.create({
    mode: 'subscription',
    customer,
    client_reference_id: b.id,
    line_items: [{ price: env('STRIPE_PRICE_ID')!, quantity: 1 }],
    allow_promotion_codes: true,
    metadata: { business_id: b.id },
    subscription_data: {
      metadata: { business_id: b.id },
      ...(trial > 0 ? { trial_period_days: trial } : {}),
    },
    locale: ctx.profile.ui_lang === 'es' ? 'es' : 'en',
    success_url: `${billing}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${billing}?canceled=1`,
  });
  return NextResponse.redirect(session.url!, 303);
}

// llegar por GET (p. ej. tras iniciar sesión) lleva a la página de suscripción
export const GET = () => NextResponse.redirect(`${appUrl()}/billing`, 303);

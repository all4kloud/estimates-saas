import { NextResponse } from 'next/server';
import { getCtx } from '@/lib/auth';
import { stripe, stripeConfigured } from '@/lib/stripe';
import { appUrl } from '@/lib/format';

// Portal de Stripe: cambiar tarjeta, ver facturas, cancelar. Solo el dueño (o superadmin).
export async function POST() {
  const ctx = await getCtx();
  const billing = `${appUrl()}/billing`;
  const b = ctx?.business;
  if (!ctx || !b || !ctx.isOwner || !b.stripe_customer_id || !stripeConfigured()) return NextResponse.redirect(billing, 303);
  const portal = await stripe().billingPortal.sessions.create({
    customer: b.stripe_customer_id,
    return_url: billing,
    locale: ctx.profile.ui_lang === 'es' ? 'es' : 'en',
  });
  return NextResponse.redirect(portal.url, 303);
}

export const GET = () => NextResponse.redirect(`${appUrl()}/billing`, 303);

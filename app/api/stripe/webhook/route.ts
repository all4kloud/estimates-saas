import { NextResponse, type NextRequest } from 'next/server';
import type Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/server';
import { markPaidFromSession } from '@/lib/payments';
import { env } from '@/lib/env';

// Webhook de Connect ("Events on connected accounts"):
//   checkout.session.completed, checkout.session.async_payment_succeeded, account.updated
// Las suscripciones de la plataforma llegan a otro endpoint: /api/stripe/billing-webhook
export async function POST(req: NextRequest) {
  const secret = env('STRIPE_WEBHOOK_SECRET');
  const sig = req.headers.get('stripe-signature');
  if (!secret || !sig) return new NextResponse('Missing signature', { status: 400 });
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(await req.text(), sig, secret);
  } catch {
    return new NextResponse('Bad signature', { status: 400 });
  }

  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded':
      await markPaidFromSession(event.data.object as Stripe.Checkout.Session);
      break;
    case 'account.updated': {
      const a = event.data.object as Stripe.Account;
      await createAdminClient().from('businesses').update({ stripe_charges_enabled: !!a.charges_enabled }).eq('stripe_account_id', a.id);
      break;
    }
  }
  return NextResponse.json({ received: true });
}

import { NextResponse, type NextRequest } from 'next/server';
import type Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { env } from '@/lib/env';
import { syncSubscription } from '@/lib/billing';

// Webhook de la CUENTA de la plataforma (no "connected accounts"):
//   checkout.session.completed, customer.subscription.created / updated / deleted / paused / resumed
// Endpoint en Stripe: https://<app>/api/stripe/billing-webhook  → secreto STRIPE_BILLING_WEBHOOK_SECRET
export async function POST(req: NextRequest) {
  const secret = env('STRIPE_BILLING_WEBHOOK_SECRET');
  const sig = req.headers.get('stripe-signature');
  if (!secret || !sig) return new NextResponse('Missing signature', { status: 400 });
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(await req.text(), sig, secret);
  } catch {
    return new NextResponse('Bad signature', { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object as Stripe.Checkout.Session;
        if (s.mode === 'subscription' && s.subscription) {
          await syncSubscription(typeof s.subscription === 'string' ? s.subscription : s.subscription.id);
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
      case 'customer.subscription.paused':
      case 'customer.subscription.resumed':
        await syncSubscription((event.data.object as Stripe.Subscription).id);
        break;
    }
  } catch (e) {
    console.error('billing-webhook', event.type, e);
    return new NextResponse('Error', { status: 500 });   // Stripe reintenta
  }
  return NextResponse.json({ received: true });
}

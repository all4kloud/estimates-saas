import { NextResponse, type NextRequest } from 'next/server';
import { getCtx } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/server';
import { stripe, stripeConfigured } from '@/lib/stripe';
import { appUrl } from '@/lib/format';

// Conecta (o continúa) la cuenta Stripe del negocio activo. Solo el dueño.
async function handle(req: NextRequest) {
  const ctx = await getCtx();
  const settings = `${appUrl()}/settings`;
  if (!ctx?.business || !ctx.isOwner || !stripeConfigured()) return NextResponse.redirect(settings, 303);
  const b = ctx.business;
  const s = stripe();
  let account = b.stripe_account_id;

  if (account && b.stripe_charges_enabled && req.method === 'POST') {
    // ya conectado: abre el panel de Stripe del negocio
    return NextResponse.redirect('https://dashboard.stripe.com/', 303);
  }
  if (!account) {
    const acct = await s.accounts.create({
      type: 'standard',
      country: 'US',
      email: b.email || ctx.profile.email,
      business_profile: { name: b.name, url: b.website ? (b.website.startsWith('http') ? b.website : `https://${b.website}`) : undefined },
      metadata: { business_id: b.id },
    });
    account = acct.id;
    await createAdminClient().from('businesses').update({ stripe_account_id: account }).eq('id', b.id);
  }
  const link = await s.accountLinks.create({
    account,
    type: 'account_onboarding',
    refresh_url: `${appUrl()}/api/stripe/connect`,
    return_url: `${settings}?stripe=return`,
  });
  return NextResponse.redirect(link.url, 303);
}

export const POST = handle;
export const GET = handle;   // refresh_url de Stripe llega por GET

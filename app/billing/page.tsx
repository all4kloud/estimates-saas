import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCtx } from '@/lib/auth';
import { billingConfigured, billingOk, priceLabel, syncFromCheckoutSession, trialDays } from '@/lib/billing';
import { fmtDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

// Fuera del grupo (app): se ve aunque la suscripción no esté al día.
export default async function BillingPage({ searchParams }: { searchParams: Promise<{ session_id?: string; canceled?: string; processing?: string }> }) {
  const ctx = await getCtx();
  if (!ctx) redirect('/login?next=/billing');
  if (!ctx.business) redirect(ctx.isSuper ? '/admin' : '/no-access');
  const { t, business: b } = ctx;
  const sp = await searchParams;

  // vuelta de Stripe Checkout: confirmar ya, sin esperar al webhook
  if (sp.session_id && billingConfigured()) {
    let synced = false;
    try { synced = await syncFromCheckoutSession(sp.session_id, b.id); } catch (e) { console.error('billing sync', e); }
    redirect(synced ? '/billing' : '/billing?processing=1');
  }

  const ok = billingOk(b);
  const lang = ctx.profile.ui_lang;
  const trial = b.subscription_status === 'none' && !b.stripe_subscription_id ? trialDays() : 0;
  const plan = (trial ? t.planLine : t.planLineNoTrial).replace('{days}', String(trial)).replace('{price}', priceLabel());
  const date = (iso: string | null) => fmtDate(iso, lang);

  let status: { cls: string; text: string };
  if (b.billing_exempt) status = { cls: 'ok', text: t.billingExempt };
  else if (b.subscription_status === 'trialing') status = { cls: 'ok', text: t.billingTrial.replace('{date}', date(b.trial_end)) };
  else if (b.subscription_status === 'active') status = { cls: 'ok', text: t.billingRenews.replace('{date}', date(b.current_period_end)) };
  else if (b.subscription_status === 'past_due') status = { cls: 'err', text: t.billingPastDue };
  else if (['canceled', 'unpaid', 'paused', 'incomplete_expired'].includes(b.subscription_status)) status = { cls: 'err', text: t.billingEnded };
  else status = { cls: 'info', text: t.billingNeeded };

  const brand = { ['--navy' as string]: b.brand_color, ['--teal' as string]: b.accent_color } as React.CSSProperties;
  return (
    <div className="auth-wrap" style={brand}>
      <div className="auth-card card">
        {b.logo_url ? <img src={b.logo_url} alt={b.name} style={{ maxHeight: 56, maxWidth: 200, marginBottom: 12 }} /> : null}
        <h1>{t.billing}</h1>
        <p className="muted small" style={{ marginTop: 0 }}>{b.name}</p>

        {sp.processing && <div className="alert info">{t.billingProcessing}</div>}
        {sp.canceled && <div className="alert err">{t.billingCanceled}</div>}
        <div className={`alert ${status.cls}`}>{status.text}</div>
        {!ok && <p className="small">{plan}</p>}

        <div className="stack">
          {ok && <Link className="btn teal block" href="/estimates">{t.goToApp}</Link>}

          {ctx.isOwner && !billingConfigured() && !ok && <div className="alert err">{t.billingNotConfigured}</div>}

          {ctx.isOwner && billingConfigured() && !ok && (
            <form action="/api/billing/checkout" method="post">
              <button className="btn teal block" type="submit">{trial ? t.billingStart : t.billingSubscribe}</button>
            </form>
          )}

          {ctx.isOwner && billingConfigured() && b.stripe_customer_id && !b.billing_exempt && (
            <form action="/api/billing/portal" method="post">
              <button className="btn ghost block" type="submit">{t.billingManage}</button>
            </form>
          )}

          {!ctx.isOwner && !ok && <div className="alert info">{t.billingOwnerOnly}</div>}

          <form action="/auth/signout" method="post">
            <button className="btn danger block" type="submit">{t.signOut}</button>
          </form>
        </div>
      </div>
    </div>
  );
}

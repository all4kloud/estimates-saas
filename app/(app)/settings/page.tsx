import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireBusiness } from '@/lib/auth';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { stripe, stripeConfigured } from '@/lib/stripe';
import { Icon } from '@/components/Icon';
import type { Service } from '@/lib/types';
import { BusinessForm, ImportForm, LogoForm, ServicesEditor } from './SettingsForms';

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ stripe?: string }> }) {
  const ctx = await requireBusiness();
  if (!ctx.canManage) redirect('/more');
  const { t } = ctx;
  let b = ctx.business;
  const sp = await searchParams;

  // al volver de Stripe, refresca el estado de la cuenta conectada
  if (sp.stripe === 'return' && b.stripe_account_id && stripeConfigured()) {
    try {
      const acct = await stripe().accounts.retrieve(b.stripe_account_id);
      const enabled = !!acct.charges_enabled;
      if (enabled !== b.stripe_charges_enabled) {
        await createAdminClient().from('businesses').update({ stripe_charges_enabled: enabled }).eq('id', b.id);
        b = { ...b, stripe_charges_enabled: enabled };
      }
    } catch { /* se actualizará por webhook */ }
  }

  const supabase = await createClient();
  const { data: services } = await supabase.from('services').select('*').eq('business_id', b.id).eq('active', true).order('sort');

  return (
    <>
      <Link href="/more" className="backlink"><Icon name="back" /> {t.more}</Link>
      <h2>{t.settings}</h2>

      <h3>{t.svcCatalog}</h3>
      <ServicesEditor t={t} initial={(services || []) as Service[]} />

      <h3>{t.payments}</h3>
      <div className="card stack">
        <div className="small">{b.stripe_account_id ? (b.stripe_charges_enabled ? t.stripeOk : t.stripePending) : t.stripeNone}</div>
        {stripeConfigured() && ctx.isOwner && (
          <form action="/api/stripe/connect" method="post">
            <button className="btn block" type="submit"><Icon name="card" />
              {!b.stripe_account_id ? t.stripeConnect : b.stripe_charges_enabled ? t.stripeDashboard : t.stripeContinue}</button>
          </form>
        )}
      </div>

      <h3>{t.logo}</h3>
      <LogoForm t={t} url={b.logo_url} />

      <BusinessForm t={t} b={b} />

      <h3>{t.importV1}</h3>
      <ImportForm t={t} />
      <div style={{ height: 30 }} />
    </>
  );
}

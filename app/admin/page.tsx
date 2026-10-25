import Link from 'next/link';
import { requireSuper } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/server';
import { fmtDate, money } from '@/lib/format';
import { Icon } from '@/components/Icon';
import { BusinessRowActions, NewBusinessForm } from './AdminForms';

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ created?: string }> }) {
  const ctx = await requireSuper();
  const { t } = ctx;
  const { created } = await searchParams;
  const admin = createAdminClient();
  const [{ data: biz }, { data: mems }, { data: docs }] = await Promise.all([
    admin.from('businesses').select('id, name, slug, email, active, created_at, stripe_charges_enabled, billing_exempt, subscription_status, current_period_end')
      .order('created_at', { ascending: false }),
    admin.from('memberships').select('business_id'),
    admin.from('documents').select('business_id, type, status, total'),
  ]);
  const stat = (id: string) => {
    const d = (docs || []).filter(x => x.business_id === id);
    return {
      users: (mems || []).filter(m => m.business_id === id).length,
      docs: d.length,
      paid: d.filter(x => x.type === 'invoice' && x.status === 'paid').reduce((a, x) => a + Number(x.total), 0),
    };
  };
  return (
    <>
      <header className="topbar">
        <Link href="/" className="backlink" style={{ margin: 0 }}><Icon name="back" /> {t.back}</Link>
        <div className="topbar-title">{t.admin}</div>
      </header>
      <main style={{ paddingBottom: 40 }}>
        {created && <div className="alert ok">{t.inviteSent}</div>}
        <h3 style={{ marginTop: 4 }}>{t.businesses} ({biz?.length || 0})</h3>
        <div className="stack">
          {(biz || []).map(b => {
            const s = stat(b.id);
            return (
              <div key={b.id} className="card">
                <div className="row">
                  <div className="grow"><b>{b.name}</b> <span className={`chip ${b.active ? 'accepted' : 'declined'}`}>{b.active ? t.active : t.inactive}</span>
                    {b.stripe_charges_enabled && <> <span className="chip paid">Stripe</span></>}
                    {' '}{b.billing_exempt
                      ? <span className="chip viewed">{t.comp}</span>
                      : <span className={`chip ${['active', 'trialing'].includes(b.subscription_status) ? 'paid' : b.subscription_status === 'none' ? '' : 'declined'}`}>
                          {t[`sub_${b.subscription_status}` as keyof typeof t]}</span>}
                    <div className="small muted">{b.slug} · {b.email} · {fmtDate(b.created_at, ctx.profile.ui_lang)}</div>
                    <div className="small muted">{s.users} {t.usersCount} · {s.docs} {t.docsCount} · {money(s.paid)} {t.paid.toLowerCase()}</div>
                  </div>
                </div>
                <BusinessRowActions t={t} id={b.id} active={b.active} exempt={b.billing_exempt} />
              </div>
            );
          })}
        </div>
        <h3>{t.newBusiness}</h3>
        <NewBusinessForm t={t} />
      </main>
    </>
  );
}

import Link from 'next/link';
import { requireBusiness } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { fmtPhone } from '@/lib/format';
import { Icon } from '@/components/Icon';
import { SearchBox } from '../SearchBox';

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const ctx = await requireBusiness();
  const { t } = ctx;
  const q = ((await searchParams).q || '').trim();
  const supabase = await createClient();
  let query = supabase.from('customers').select('id, name, phone, email, lang, documents(count)').eq('business_id', ctx.business.id).order('name').limit(300);
  if (q) {
    const s = q.replace(/[%,()]/g, ' ');
    query = query.or(`name.ilike.%${s}%,phone.ilike.%${s}%,email.ilike.%${s}%`);
  }
  const { data } = await query;
  return (
    <>
      <SearchBox placeholder={t.search} initial={q} />
      <div className="stack">
        {data?.length ? data.map(c => (
          <Link key={c.id} href={`/customers/${c.id}`} className="card doc-item">
            <div className="grow"><b>{c.name}</b>{c.lang === 'es' && <> <span className="chip">ES</span></>}
              <div className="small muted">{[fmtPhone(c.phone), c.email].filter(Boolean).join(' · ')}</div></div>
            <span className="small muted">{(c.documents as unknown as { count: number }[])?.[0]?.count ?? 0} doc</span>
          </Link>
        )) : <div className="empty"><b>{t.noCustomers}</b>{t.noCustomersSub}</div>}
      </div>
      <Link className="btn teal fab" href="/customers/new"><Icon name="plus" /> {t.newCustomer}</Link>
    </>
  );
}

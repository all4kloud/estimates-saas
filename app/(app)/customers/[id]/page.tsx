import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireBusiness } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { fmtDate, money } from '@/lib/format';
import { Icon } from '@/components/Icon';
import type { Customer } from '@/lib/types';
import { CustomerForm, DeleteCustomer } from './CustomerForm';

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireBusiness();
  const { t } = ctx;
  const { id } = await params;
  const isNew = id === 'new';
  const supabase = await createClient();
  let c: Customer | null = null;
  let docs: { id: string; number: string; type: string; status: string; issue_date: string; total: number }[] = [];
  if (!isNew) {
    const { data } = await supabase.from('customers').select('*').eq('id', id).eq('business_id', ctx.business.id).maybeSingle();
    if (!data) notFound();
    c = data as Customer;
    const r = await supabase.from('documents').select('id, number, type, status, issue_date, total').eq('customer_id', id).order('created_at', { ascending: false });
    docs = r.data || [];
  }
  return (
    <>
      <Link href="/customers" className="backlink"><Icon name="back" /> {t.customers}</Link>
      <h2>{c ? c.name : t.newCustomer}</h2>
      <CustomerForm t={t} c={c} defaultLang={ctx.business.default_lang} />
      {c && (
        <>
          <Link className="btn block" href={`/documents/new?type=estimate&customer=${c.id}`} style={{ marginTop: 12 }}><Icon name="plus" /> {t.newDocFor}</Link>
          {docs.length > 0 && (
            <>
              <h3>{t.customerDocs}</h3>
              <div className="stack">{docs.map(d => (
                <Link key={d.id} href={`/documents/${d.id}`} className="card doc-item">
                  <div className="grow"><span className="num">{d.number}</span> <span className={`chip ${d.status}`}>{t[d.status as keyof typeof t]}</span>
                    <div className="small muted">{fmtDate(d.issue_date, ctx.profile.ui_lang)}</div></div>
                  <b>{money(d.total)}</b>
                </Link>
              ))}</div>
            </>
          )}
          {docs.length === 0 && <DeleteCustomer t={t} id={c.id} />}
        </>
      )}
    </>
  );
}

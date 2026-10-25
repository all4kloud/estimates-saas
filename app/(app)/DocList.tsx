import Link from 'next/link';
import { requireBusiness } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { fmtDate, money } from '@/lib/format';
import { Icon } from '@/components/Icon';
import type { DocType } from '@/lib/types';
import { SearchBox } from './SearchBox';

export async function DocList({ type, sp }: { type: DocType; sp: { status?: string; q?: string } }) {
  const ctx = await requireBusiness();
  const { t } = ctx;
  const supabase = await createClient();
  const base = type === 'estimate' ? '/estimates' : '/invoices';
  const filters = type === 'estimate' ? ['all', 'draft', 'sent', 'viewed', 'accepted', 'declined'] : ['all', 'unpaid', 'paid'];
  const status = filters.includes(sp.status || '') ? sp.status! : 'all';
  const q = (sp.q || '').trim();

  let query = supabase.from('documents')
    .select('id, number, status, lang, issue_date, total, customer:customers!inner(name)')
    .eq('business_id', ctx.business.id).eq('type', type).order('created_at', { ascending: false }).limit(200);
  if (status === 'unpaid') query = query.not('status', 'in', '(paid,void)');
  else if (status !== 'all') query = query.eq('status', status);
  if (q) {
    const safe = q.replace(/[%,()]/g, ' ');
    query = /\d/.test(safe) && !/\s/.test(safe) ? query.ilike('number', `%${safe}%`) : query.ilike('customer.name', `%${safe}%`);
  }
  const { data: docs } = await query;

  let owed = 0;
  if (type === 'invoice') {
    const { data: un } = await supabase.from('documents').select('total').eq('business_id', ctx.business.id).eq('type', 'invoice').not('status', 'in', '(paid,void)');
    owed = (un || []).reduce((a, d) => a + Number(d.total), 0);
  }

  const href = (s: string) => `${base}?${new URLSearchParams({ ...(s !== 'all' ? { status: s } : {}), ...(q ? { q } : {}) })}`;
  return (
    <>
      <SearchBox placeholder={t.search} initial={q} />
      <div className="filters">{filters.map(f => <Link key={f} href={href(f)} className={status === f ? 'on' : ''}>{t[f as keyof typeof t]}</Link>)}</div>
      {type === 'invoice' && owed > 0 && (
        <div className="card row" style={{ marginBottom: 10 }}><div className="grow muted">{t.unpaid}</div><b style={{ color: 'var(--warn)' }}>{money(owed)}</b></div>
      )}
      <div className="stack">
        {docs && docs.length ? docs.map(d => (
          <Link key={d.id} href={`/documents/${d.id}`} className="card doc-item">
            <div className="grow">
              <div className="row"><span className="num">{d.number}</span><span className={`chip ${d.status}`}>{t[d.status as keyof typeof t]}</span>{d.lang === 'es' && <span className="chip">ES</span>}</div>
              <div className="small" style={{ marginTop: 2 }}>{(d.customer as unknown as { name: string })?.name}</div>
              <div className="small muted">{fmtDate(d.issue_date, ctx.profile.ui_lang)}</div>
            </div>
            <div className="amt">{money(d.total)}</div>
          </Link>
        )) : (
          <div className="empty"><b>{type === 'estimate' ? t.noEst : t.noInv}</b>{type === 'estimate' ? t.noEstSub : t.noInvSub}</div>
        )}
      </div>
      <Link className="btn teal fab" href={`/documents/new?type=${type}`}><Icon name="plus" /> {type === 'estimate' ? t.newEstimate : t.newInvoice}</Link>
    </>
  );
}

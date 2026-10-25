import { requireBusiness } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { todayISO } from '@/lib/format';
import type { Customer, Service } from '@/lib/types';
import { DocEditor } from '../DocEditor';

export default async function NewDocPage({ searchParams }: { searchParams: Promise<{ type?: string; customer?: string }> }) {
  const ctx = await requireBusiness();
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data: services }, { data: customers }] = await Promise.all([
    supabase.from('services').select('*').eq('business_id', ctx.business.id).eq('active', true).order('sort'),
    supabase.from('customers').select('*').eq('business_id', ctx.business.id).order('name'),
  ]);
  return (
    <DocEditor t={ctx.t} type={sp.type === 'invoice' ? 'invoice' : 'estimate'} services={(services || []) as Service[]}
      customers={(customers || []) as Customer[]} presetCustomer={sp.customer}
      defaults={{ lang: ctx.business.default_lang, tax_rate: Number(ctx.business.tax_rate), date: todayISO() }} />
  );
}

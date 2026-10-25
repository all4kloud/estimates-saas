import { notFound } from 'next/navigation';
import { requireBusiness } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { loadDoc } from '@/lib/docs';
import { todayISO } from '@/lib/format';
import type { Customer, Service } from '@/lib/types';
import { DocEditor } from '../../DocEditor';

export default async function EditDocPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireBusiness();
  const { id } = await params;
  const supabase = await createClient();
  const doc = await loadDoc(supabase, { id });
  if (!doc || doc.business_id !== ctx.business.id) notFound();
  const [{ data: services }, { data: customers }] = await Promise.all([
    supabase.from('services').select('*').eq('business_id', ctx.business.id).eq('active', true).order('sort'),
    supabase.from('customers').select('*').eq('business_id', ctx.business.id).order('name'),
  ]);
  return (
    <DocEditor t={ctx.t} type={doc.type} services={(services || []) as Service[]} customers={(customers || []) as Customer[]}
      defaults={{ lang: doc.lang, tax_rate: Number(doc.tax_rate), date: todayISO() }}
      initial={{
        id: doc.id, number: doc.number, type: doc.type, customer_id: doc.customer_id, lang: doc.lang, issue_date: doc.issue_date,
        notes: doc.notes, tax_rate: Number(doc.tax_rate),
        items: doc.items.map(i => ({ service_id: i.service_id, name_en: i.name_en, name_es: i.name_es, qty: Number(i.qty), price: Number(i.price) })),
      }} />
  );
}

'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireBusiness } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import type { FormState } from '@/components/ui';

export async function saveCustomer(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireBusiness();
  const id = String(fd.get('id') || '');
  const name = String(fd.get('name') || '').trim();
  if (!name) return { error: ctx.t.needName };
  const v = {
    name: name.slice(0, 160), phone: String(fd.get('phone') || '').trim().slice(0, 40),
    email: String(fd.get('email') || '').trim().toLowerCase().slice(0, 160), address: String(fd.get('address') || '').trim().slice(0, 240),
    lang: fd.get('lang') === 'es' ? 'es' : 'en', notes: String(fd.get('notes') || '').slice(0, 2000),
  };
  const supabase = await createClient();
  const { data, error } = id
    ? await supabase.from('customers').update(v).eq('id', id).select('id').single()
    : await supabase.from('customers').insert({ ...v, business_id: ctx.business.id }).select('id').single();
  if (error) return { error: error.message };
  revalidatePath('/customers');
  if (!id) redirect(`/customers/${data.id}`);
  return { ok: ctx.t.saved };
}

export async function deleteCustomer(id: string) {
  const ctx = await requireBusiness();
  const supabase = await createClient();
  const { count } = await supabase.from('documents').select('id', { count: 'exact', head: true }).eq('customer_id', id);
  if (count) throw new Error(ctx.t.cantDelCustomer);
  await supabase.from('customers').delete().eq('id', id);
  revalidatePath('/customers');
  redirect('/customers');
}

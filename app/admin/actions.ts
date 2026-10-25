'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { BID_COOKIE, requireSuper } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/server';
import { inviteToBusiness } from '@/lib/invite';
import { num, slugify } from '@/lib/format';
import type { FormState } from '@/components/ui';

export async function createBusiness(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireSuper();
  const s = (k: string, max = 200) => String(fd.get(k) || '').trim().slice(0, max);
  const name = s('name', 120);
  const ownerEmail = s('owner_email').toLowerCase();
  if (!name || !ownerEmail) return { error: ctx.t.needName };
  const slug = slugify(s('slug') || name) || `biz-${Date.now()}`;
  const admin = createAdminClient();

  const { data: biz, error } = await admin.from('businesses').insert({
    name, slug, owner_name: s('owner_name', 120), phone: s('phone', 40), email: s('email') || ownerEmail,
    address1: s('address1'), address2: s('address2'), website: s('website'), default_lang: fd.get('default_lang') === 'es' ? 'es' : 'en',
  }).select('id').single();
  if (error) return { error: error.code === '23505' ? `${ctx.t.slug}: "${slug}" ya existe` : error.message };

  // servicios iniciales: "inglés | español | precio" por línea
  const services = s('services', 5000).split('\n').map(l => l.split('|').map(x => x.trim())).filter(p => p[0])
    .map((p, i) => ({ business_id: biz.id, name_en: p[0], name_es: p[1] || '', price: Math.max(num(p[2]), 0), sort: i }));
  if (services.length) await admin.from('services').insert(services);

  try {
    await inviteToBusiness({ email: ownerEmail, businessId: biz.id, role: 'owner', fullName: s('owner_name', 120) });
  } catch (e) {
    await admin.from('businesses').delete().eq('id', biz.id);
    return { error: e instanceof Error ? e.message : ctx.t.error };
  }
  revalidatePath('/admin');
  redirect('/admin?created=1');
}

export async function setActive(id: string, active: boolean) {
  await requireSuper();
  await createAdminClient().from('businesses').update({ active }).eq('id', id);
  revalidatePath('/admin');
}

/** Cortesía: el negocio usa la app sin suscripción (pilotos, socios). */
export async function setExempt(id: string, exempt: boolean) {
  await requireSuper();
  await createAdminClient().from('businesses').update({ billing_exempt: exempt }).eq('id', id);
  revalidatePath('/admin');
}

export async function enterBusiness(id: string) {
  await requireSuper();
  (await cookies()).set(BID_COOKIE, id, { path: '/', httpOnly: true, sameSite: 'lax', secure: true, maxAge: 60 * 60 * 24 * 365 });
  redirect('/estimates');
}

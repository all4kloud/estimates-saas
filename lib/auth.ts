import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from './supabase/server';
import { dict, type Dict } from './i18n/ui';
import { billingOk } from './billing';
import type { Business, Profile, Role } from './types';

export const BID_COOKIE = 'bid';

export interface Ctx {
  userId: string;
  profile: Profile;
  t: Dict;
  businesses: (Business & { role: Role | null })[];
  business: (Business & { role: Role | null }) | null;
  role: Role | null;          // rol en el negocio activo (null si superadmin sin membresía)
  isSuper: boolean;
  canManage: boolean;         // owner/admin o superadmin
  isOwner: boolean;           // owner o superadmin
}

/** Usuario, perfil y negocio activo. Cacheado por request. */
export const getCtx = cache(async (): Promise<Ctx | null> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single<Profile>();
  if (!profile) return null;

  const { data: mems } = await supabase.from('memberships').select('role, business:businesses(*)').eq('user_id', user.id);
  let businesses: (Business & { role: Role | null })[] = (mems || [])
    .filter(m => m.business)
    .map(m => ({ ...(m.business as unknown as Business), role: m.role as Role }));

  if (profile.is_superadmin) {
    const { data: all } = await supabase.from('businesses').select('*').order('name');
    const roles = new Map(businesses.map(b => [b.id, b.role]));
    businesses = (all || []).map(b => ({ ...(b as Business), role: roles.get(b.id) ?? null }));
  } else {
    businesses = businesses.filter(b => b.active);
  }
  businesses.sort((a, b) => a.name.localeCompare(b.name));

  const store = await cookies();
  const wanted = store.get(BID_COOKIE)?.value;
  const business = businesses.find(b => b.id === wanted) || businesses[0] || null;
  const role = business?.role ?? null;
  const isSuper = profile.is_superadmin;

  return {
    userId: user.id, profile, t: dict(profile.ui_lang), businesses, business, role, isSuper,
    canManage: isSuper || role === 'owner' || role === 'admin',
    isOwner: isSuper || role === 'owner',
  };
});

/** Para páginas dentro de la app: exige sesión, negocio activo y suscripción al día. */
export async function requireBusiness() {
  const ctx = await getCtx();
  if (!ctx) redirect('/login');
  if (!ctx.business) redirect(ctx.isSuper ? '/admin' : '/no-access');
  if (!ctx.isSuper && !billingOk(ctx.business)) redirect('/billing');
  return ctx as Ctx & { business: NonNullable<Ctx['business']> };
}

export async function requireManager() {
  const ctx = await requireBusiness();
  if (!ctx.canManage) throw new Error(ctx.t.notAllowed);
  return ctx;
}

export async function requireSuper() {
  const ctx = await getCtx();
  if (!ctx) redirect('/login');
  if (!ctx.isSuper) redirect('/');
  return ctx;
}

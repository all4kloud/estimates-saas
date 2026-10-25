'use server';
import { revalidatePath } from 'next/cache';
import { requireManager } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/server';
import { inviteToBusiness, resendAccess } from '@/lib/invite';
import type { FormState } from '@/components/ui';
import type { Role } from '@/lib/types';

const ROLES: Role[] = ['owner', 'admin', 'member'];

export async function inviteMember(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireManager();
  const role = String(fd.get('role')) as Role;
  if (!ROLES.includes(role)) return { error: ctx.t.error };
  if (role === 'owner' && !ctx.isOwner) return { error: ctx.t.notAllowed };
  try {
    await inviteToBusiness({ email: String(fd.get('email') || ''), businessId: ctx.business.id, role, fullName: String(fd.get('full_name') || '') });
  } catch (e) { return { error: e instanceof Error ? e.message : ctx.t.error }; }
  revalidatePath('/team');
  return { ok: ctx.t.inviteSent };
}

/** Reglas: solo un dueño crea/quita/degrada dueños; nadie se cambia el rol a sí mismo; siempre queda un dueño (lo asegura la BD). */
async function guard(userId: string) {
  const ctx = await requireManager();
  if (userId === ctx.userId && !ctx.isSuper) throw new Error(ctx.t.notAllowed);
  const admin = createAdminClient();
  const { data: m } = await admin.from('memberships').select('role').eq('business_id', ctx.business.id).eq('user_id', userId).single();
  if (!m) throw new Error(ctx.t.error);
  if (m.role === 'owner' && !ctx.isOwner) throw new Error(ctx.t.notAllowed);
  return { ctx, admin, current: m.role as Role };
}

export async function changeRole(userId: string, role: Role) {
  if (!ROLES.includes(role)) return;
  const { ctx, admin } = await guard(userId);
  if (role === 'owner' && !ctx.isOwner) throw new Error(ctx.t.notAllowed);
  const { error } = await admin.from('memberships').update({ role }).eq('business_id', ctx.business.id).eq('user_id', userId);
  if (error) throw new Error(error.message);
  revalidatePath('/team');
}

export async function removeMember(userId: string) {
  const { ctx, admin } = await guard(userId);
  const { error } = await admin.from('memberships').delete().eq('business_id', ctx.business.id).eq('user_id', userId);
  if (error) throw new Error(error.message);
  revalidatePath('/team');
}

export async function resendInvite(email: string) {
  const ctx = await requireManager();
  const admin = createAdminClient();
  // solo a personas de este negocio
  const { data } = await admin.from('profiles').select('id, memberships!inner(business_id)').eq('email', email).eq('memberships.business_id', ctx.business.id).maybeSingle();
  if (!data) throw new Error(ctx.t.notAllowed);
  await resendAccess(email);
}

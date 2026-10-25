import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireBusiness } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Icon } from '@/components/Icon';
import type { Role } from '@/lib/types';
import { InviteForm, MemberRow } from './TeamForms';

export default async function TeamPage() {
  const ctx = await requireBusiness();
  if (!ctx.canManage) redirect('/more');
  const { t } = ctx;
  const supabase = await createClient();
  const { data } = await supabase.from('memberships')
    .select('role, created_at, profile:profiles(id, email, full_name)')
    .eq('business_id', ctx.business.id).order('created_at');
  const members = (data || []).map(m => ({ role: m.role as Role, ...(m.profile as unknown as { id: string; email: string; full_name: string }) }));
  return (
    <>
      <Link href="/more" className="backlink"><Icon name="back" /> {t.more}</Link>
      <h2>{t.team}</h2>
      <p className="small muted" style={{ marginTop: -6 }}>{t.roleHelp}</p>
      <div className="card">
        {members.map(m => (
          <MemberRow key={m.id} t={t} m={m} isSelf={m.id === ctx.userId}
            canEdit={(m.id !== ctx.userId || ctx.isSuper) && (m.role !== 'owner' || ctx.isOwner)} canMakeOwner={ctx.isOwner} />
        ))}
      </div>
      <h3>{t.invite}</h3>
      <InviteForm t={t} canMakeOwner={ctx.isOwner} />
    </>
  );
}

import Link from 'next/link';
import { requireBusiness } from '@/lib/auth';
import { RegisterSW } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { BusinessSwitcher, Tabbar } from './shell';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireBusiness();
  const b = ctx.business;
  const brand = { ['--navy' as string]: b.brand_color, ['--teal' as string]: b.accent_color } as React.CSSProperties;
  return (
    <div style={brand}>
      <RegisterSW />
      <header className="topbar">
        <Link href="/estimates" style={{ display: 'flex', alignItems: 'center', minWidth: 0, textDecoration: 'none' }}>
          {b.logo_url ? <img src={b.logo_url} alt={b.name} className="topbar-logo" /> : <span className="topbar-name">{b.name}</span>}
        </Link>
        <div style={{ flex: 1 }} />
        <BusinessSwitcher items={ctx.businesses.map(x => ({ id: x.id, name: x.name }))} current={b.id} label={ctx.t.switchBusiness} />
        <Link href="/account" className="icon-btn" aria-label={ctx.t.account}><Icon name="user" /></Link>
      </header>
      {!b.active && <div className="alert err" style={{ margin: 0, borderRadius: 0 }}>{ctx.t.inactive}</div>}
      <main>{children}</main>
      <Tabbar t={ctx.t} />
    </div>
  );
}

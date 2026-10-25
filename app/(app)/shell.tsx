'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/Icon';
import type { Dict } from '@/lib/i18n/ui';
import { switchBusiness } from './actions/business';

export function Tabbar({ t }: { t: Dict }) {
  const path = usePathname();
  const tabs = [
    { href: '/estimates', icon: 'est', label: t.estimates, match: (p: string) => p.startsWith('/estimates') },
    { href: '/invoices', icon: 'inv', label: t.invoices, match: (p: string) => p.startsWith('/invoices') },
    { href: '/customers', icon: 'users', label: t.customers, match: (p: string) => p.startsWith('/customers') },
    { href: '/more', icon: 'menu', label: t.more, match: (p: string) => ['/more', '/settings', '/team'].some(x => p.startsWith(x)) },
  ];
  return (
    <nav className="tabbar">
      {tabs.map(tb => (
        <Link key={tb.href} href={tb.href} className={tb.match(path) ? 'on' : ''}>
          <Icon name={tb.icon} /><span>{tb.label}</span>
        </Link>
      ))}
    </nav>
  );
}

export function BusinessSwitcher({ items, current, label }: { items: { id: string; name: string }[]; current: string; label: string }) {
  if (items.length < 2) return null;
  return (
    <select className="in" aria-label={label} value={current} style={{ maxWidth: 170, padding: '8px 10px', fontSize: 14 }}
      onChange={e => switchBusiness(e.target.value)}>
      {items.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
    </select>
  );
}

'use client';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export function SearchBox({ placeholder, initial }: { placeholder: string; initial: string }) {
  const [q, setQ] = useState(initial);
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  useEffect(() => {
    if (q === initial) return;
    const id = setTimeout(() => {
      const p = new URLSearchParams(sp.toString());
      if (q) p.set('q', q); else p.delete('q');
      router.replace(`${path}?${p}`);
    }, 300);
    return () => clearTimeout(id);
  }, [q, initial, path, router, sp]);
  return <input className="in search" placeholder={placeholder} value={q} onChange={e => setQ(e.target.value)} inputMode="search" />;
}

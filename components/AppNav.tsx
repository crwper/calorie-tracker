// components/AppNav.tsx
'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import { isValidYMD } from '@/lib/dates';

export default function AppNav({ defaultTodayYMD }: { defaultTodayYMD: string }) {
  const pathname = usePathname();
  const search = useSearchParams();

  const pathYMD = useMemo(() => {
    const m = /^\/day\/(\d{4}-\d{2}-\d{2})$/.exec(pathname);
    return m && isValidYMD(m[1]) ? m[1] : null;
  }, [pathname]);

  const nextYMD = useMemo(() => {
    const next = search.get('next');
    if (!next) return null;
    try {
      const u = new URL(next, 'http://local');
      const m = /^\/day\/(\d{4}-\d{2}-\d{2})$/.exec(u.pathname);
      return m && isValidYMD(m[1]) ? m[1] : null;
    } catch {
      const m = /^\/day\/(\d{4}-\d{2}-\d{2})$/.exec(next);
      return m && isValidYMD(m[1]) ? m[1] : null;
    }
  }, [search]);

  const dayRef = pathYMD ?? nextYMD ?? defaultTodayYMD;

  const dayHref = `/day/${dayRef}`;
  const catalogHref = `/catalog?next=${encodeURIComponent(dayHref)}`;
  const weightsHref = `/weights?next=${encodeURIComponent(dayHref)}`;
  const goalsHref = `/goals?next=${encodeURIComponent(dayHref)}`;
  const chartsHref = `/charts?next=${encodeURIComponent(dayHref)}`;

  const isDay = pathname.startsWith('/day/');
  const isCatalog = pathname.startsWith('/catalog');
  const isWeights = pathname.startsWith('/weights');
  const isGoals = pathname.startsWith('/goals');
  const isCharts = pathname.startsWith('/charts');

  const base =
    'rounded px-3 py-1 text-sm border hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-slate-300';
  const active = 'bg-gray-100 font-medium';

  return (
    <nav className="border-t bg-white">
      <div className="mx-auto max-w-2xl p-2">
        <ul className="flex items-center gap-2">
          <li><Link href={catalogHref} className={`${base} ${isCatalog ? active : ''}`} aria-current={isCatalog ? 'page' : undefined}>Catalog</Link></li>
          <li><Link href={dayHref} className={`${base} ${isDay ? active : ''}`} aria-current={isDay ? 'page' : undefined}>Day</Link></li>
          <li><Link href={goalsHref} className={`${base} ${isGoals ? active : ''}`} aria-current={isGoals ? 'page' : undefined}>Goals</Link></li>
          <li><Link href={weightsHref} className={`${base} ${isWeights ? active : ''}`} aria-current={isWeights ? 'page' : undefined}>Weights</Link></li>
          <li><Link href={chartsHref} className={`${base} ${isCharts ? active : ''}`} aria-current={isCharts ? 'page' : undefined}>Charts</Link></li>
        </ul>
      </div>
    </nav>
  );
}

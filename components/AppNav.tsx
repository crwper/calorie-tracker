// components/AppNav.tsx
'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import { isValidYMD } from '@/lib/dates';

export default function AppNav({ defaultTodayYMD }: { defaultTodayYMD: string }) {
  const pathname = usePathname();
  const search = useSearchParams();

  // 1) If we're on /day/<ymd>, that's the authoritative context.
  const pathYMD = useMemo(() => {
    const m = /^\/day\/(\d{4}-\d{2}-\d{2})$/.exec(pathname);
    return m && isValidYMD(m[1]) ? m[1] : null;
  }, [pathname]);

  // 2) Otherwise, if ?next=/day/<ymd> exists, use that.
  const nextYMD = useMemo(() => {
    const next = search.get('next');
    if (!next) return null;

    // next is a relative path; try strict parse first, then fall back to a simple regex.
    try {
      const u = new URL(next, 'http://local'); // base is required for relative URLs
      const m = /^\/day\/(\d{4}-\d{2}-\d{2})$/.exec(u.pathname);
      return m && isValidYMD(m[1]) ? m[1] : null;
    } catch {
      const m = /^\/day\/(\d{4}-\d{2}-\d{2})$/.exec(next);
      return m && isValidYMD(m[1]) ? m[1] : null;
    }
  }, [search]);

  // 3) Fallback to "today" in the user's cookie TZ (provided by the server).
  const dayRef = pathYMD ?? nextYMD ?? defaultTodayYMD;

  const dayHref = `/day/${dayRef}`;
  const catalogHref = `/catalog?next=${encodeURIComponent(dayHref)}`;

  const isDay = pathname.startsWith('/day/');
  const isCatalog = pathname.startsWith('/catalog');

  const base =
    'rounded px-3 py-1 text-sm border hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-slate-300';
  const active = 'bg-gray-100 font-medium';

  return (
    <nav className="border-t bg-white">
      <div className="mx-auto max-w-2xl p-2">
        <ul className="flex items-center gap-2">
          <li>
            <Link
              href={dayHref}
              aria-current={isDay ? 'page' : undefined}
              className={`${base} ${isDay ? active : ''}`}
              title="Go to Day"
            >
              Day
            </Link>
          </li>
          <li>
            <Link
              href={catalogHref}
              aria-current={isCatalog ? 'page' : undefined}
              className={`${base} ${isCatalog ? active : ''}`}
              title="Go to Catalog"
            >
              Catalog
            </Link>
          </li>
        </ul>
      </div>
    </nav>
  );
}

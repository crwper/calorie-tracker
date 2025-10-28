// components/CatalogChipPicker.tsx
'use client';

import { useMemo, useState } from 'react';
import RefreshOnActionComplete from '@/components/RefreshOnActionComplete';

type Item = {
  id: string;
  name: string;
  unit: string;
  kcal_per_unit: number | string;
  default_qty: number | string;
  created_at: string;
  // From RPC (not required by the UI, but harmless to keep around):
  last_used_date?: string | null;
  first_order_on_last_day?: number | null;
};

export default function CatalogChipPicker({
  items,
  selectedYMD,
  addFromCatalogAction,
  visibleLimit = 20,
}: {
  items: Item[];
  selectedYMD: string;
  addFromCatalogAction: (formData: FormData) => Promise<void>;
  /** How many to show when the search box is empty */
  visibleLimit?: number;
}) {
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((it) =>
      it.name.toLowerCase().includes(s) || it.unit.toLowerCase().includes(s)
    );
  }, [q, items]);

  // Show only the top N (by the server’s ordering) when q is empty.
  const display = q.trim() ? filtered : filtered.slice(0, visibleLimit);
  const truncated = !q.trim() && filtered.length > visibleLimit;

  return (
    <div>
      {/* Live search input */}
      <div className="mb-2 flex items-center gap-2">
        <label htmlFor="catalog-q" className="sr-only">Search catalog</label>
        <input
          id="catalog-q"
          value={q}
          onChange={(e) => setQ(e.currentTarget.value)}
          placeholder="Search catalog…"
          className="border rounded px-2 py-1 text-sm flex-1 min-w-0"
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ('')}
            className="rounded border px-2 py-1 text-sm hover:bg-gray-50"
          >
            Clear
          </button>
        )}
      </div>

      {/* Chips list (filtered live, keeps original ordering from server) */}
      <div className="flex flex-wrap gap-2">
        {display.map((it) => (
          <form key={it.id} action={addFromCatalogAction}>
            <input type="hidden" name="date" value={selectedYMD} />
            <input type="hidden" name="mult" value="1" />
            <button
              type="submit"
              name="catalog_item_id"
              value={it.id}
              className="border rounded px-2 py-1 text-left text-xs bg-slate-50 hover:bg-gray-50 active:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-slate-300"
              aria-label={`Add ${it.name}`}
            >
              <div className="font-medium">{it.name}</div>
              <div className="text-[11px] text-gray-600">
                {Number(it.default_qty).toString()} {it.unit}
              </div>
            </button>
            {/* Ensure the day view refreshes after adding */}
            <RefreshOnActionComplete debounceMs={250} />
          </form>
        ))}
        {filtered.length === 0 && (
          <div className="text-sm text-gray-600">No matches.</div>
        )}
        {truncated && (
          <div className="text-xs text-gray-500">Showing top {visibleLimit}. Type to search all.</div>
        )}
      </div>
    </div>
  );
}
// components/CatalogChipPicker.tsx
'use client';

import { useMemo, useState, useRef, FormEvent } from 'react';
import RefreshOnActionComplete from '@/components/RefreshOnActionComplete';
import { registerPendingOp } from '@/components/realtime/opRegistry';

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
            className="rounded border px-2 py-1 text-sm hover:bg-control-hover"
          >
            Clear
          </button>
        )}
      </div>

      {/* Chips list (filtered live, keeps original ordering from server) */}
      <div className="flex flex-wrap gap-2">
        {display.map((it) => (
          <CatalogChipForm
            key={it.id}
            item={it}
            selectedYMD={selectedYMD}
            addFromCatalogAction={addFromCatalogAction}
          />
        ))}
        {filtered.length === 0 && (
          <div className="text-sm text-muted-foreground">No matches.</div>
        )}
        {truncated && (
          <div className="text-xs text-subtle-foreground">
            Showing top {visibleLimit}. Type to search all.
          </div>
        )}
      </div>
    </div>
  );
}

function CatalogChipForm({
  item,
  selectedYMD,
  addFromCatalogAction,
}: {
  item: Item;
  selectedYMD: string;
  addFromCatalogAction: (formData: FormData) => Promise<void>;
}) {
  const clientOpInputRef = useRef<HTMLInputElement | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    // Generate a new op-id for THIS gesture
    const opId = crypto.randomUUID();

    // Stamp it into the hidden input so the server can read it
    if (clientOpInputRef.current) {
      clientOpInputRef.current.value = opId;
    }

    // Register this op locally so Realtime can recognize it later
    registerPendingOp({
      id: opId,
      kind: 'add_from_catalog',
      // no entryIds yet; we don't know the DB id until after insert
      startedAt: Date.now(),
    });

    // Let the normal form submission proceed
    // (no preventDefault here)
  };

  return (
    <form action={addFromCatalogAction} onSubmit={handleSubmit}>
      <input type="hidden" name="date" value={selectedYMD} />
      <input type="hidden" name="mult" value="1" />
      <input
        ref={clientOpInputRef}
        type="hidden"
        name="client_op_id"
        defaultValue=""
      />
      <button
        type="submit"
        name="catalog_item_id"
        value={item.id}
        className="border rounded px-2 py-1 text-left text-xs bg-chip-face hover:bg-chip-hover active:bg-chip-pressed focus:outline-none focus:ring-2 focus:ring-control-ring"
        aria-label={`Add ${item.name}`}
      >
        <div className="font-medium">{item.name}</div>
        <div className="text-[11px] text-muted-foreground">
          {Number(item.default_qty).toString()} {item.unit}
        </div>
      </button>
      {/* Ensure the day view refreshes after adding (for now) */}
      <RefreshOnActionComplete debounceMs={250} />
    </form>
  );
}

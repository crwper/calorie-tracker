// components/EntriesList.tsx
'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  DndContext,
  closestCenter,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import {
  reorderEntriesAction,
  updateEntryQtyAction,
  toggleEntryStatusAction,
} from '@/app/actions';
import DeleteEntryButton from '@/components/DeleteEntryButton';
import RefreshOnActionComplete from '@/components/RefreshOnActionComplete';

type Entry = {
  id: string;
  name: string;
  qty: string;
  unit: string;
  kcal_snapshot: number;
  status: 'planned' | 'eaten';
  created_at: string;
};

/* NEW: mounted guard to avoid SSR/CSR attribute mismatches */
function useIsMounted() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}

export default function EntriesList({
  entries,
  selectedYMD,
}: {
  entries: Entry[];
  selectedYMD: string;
}) {
  const [items, setItems] = useState(entries);
  const [saving, setSaving] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    setItems(entries);
  }, [entries]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    // small delay+tolerance so casual swipes don't instantly start a drag
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
  );

  async function persistOrder(next: Entry[], prev: Entry[]) {
    try {
      setSaving(true);
      await reorderEntriesAction({
        date: selectedYMD,
        ids: next.map((e) => e.id),
      });
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      console.error(err);
      setItems(prev);
      alert('Reorder failed. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((x) => x.id === active.id);
    const newIndex = items.findIndex((x) => x.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const prev = items;
    const next = arrayMove(items, oldIndex, newIndex);

    setItems(next);
    void persistOrder(next, prev);
  }

  function applyQtyOptimistic(id: string, newQty: number) {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const oldQty = parseFloat(String(it.qty)) || 0;
        const perUnit = oldQty > 0 ? Number(it.kcal_snapshot) / oldQty : undefined;
        return {
          ...it,
          qty: String(newQty),
          kcal_snapshot: perUnit ? Number((perUnit * newQty).toFixed(2)) : it.kcal_snapshot,
        };
      })
    );
  }

  function applyStatusOptimistic(id: string, next: 'planned' | 'eaten') {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, status: next } : it)));
  }

  if (items.length === 0) {
    return (
      <ul className="divide-y">
        <li className="py-2 text-sm text-gray-600">No entries yet.</li>
      </ul>
    );
  }

  const disableDnD = saving || isPending;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((e) => e.id)} strategy={verticalListSortingStrategy}>
        <ul className="divide-y">
          {items.map((e) => (
            <SortableEntry
              key={e.id}
              e={e}
              selectedYMD={selectedYMD}
              disabled={disableDnD}
              onQtyOptimistic={applyQtyOptimistic}
              onStatusOptimistic={applyStatusOptimistic}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

/* ---- Single sortable row ---- */

function SortableEntry({
  e,
  selectedYMD,
  disabled,
  onQtyOptimistic,
  onStatusOptimistic,
}: {
  e: Entry;
  selectedYMD: string;
  disabled?: boolean;
  onQtyOptimistic: (id: string, qty: number) => void;
  onStatusOptimistic: (id: string, next: 'planned' | 'eaten') => void;
}) {
  const mounted = useIsMounted(); // NEW
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: e.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`py-2 flex items-start justify-between rounded-md ${
        e.status === 'planned' ? 'bg-amber-50 border-l-4 border-amber-400' : ''
      }`}
    >
      <div className="flex items-center gap-2 pr-2">
        {/* Drag handle */}
        <button
          type="button"
          aria-label="Drag to reorder"
          role="button"
          className="rounded border px-2 py-1 text-xs cursor-grab active:cursor-grabbing select-none bg-white disabled:opacity-60 flex items-center justify-center touch-none"
          /* NEW: attach dnd-kit attributes/listeners only after mount */
          {...(mounted ? attributes : {})}
          {...(mounted ? listeners : {})}
          suppressHydrationWarning
          disabled={disabled}
        >
          ≡
        </button>
      </div>

      <div className="flex-1">
        <div className="font-medium">{e.name}</div>

        {/* Qty editor + status toggle */}
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-600">
          {/* Qty edit */}
          <form
            action={updateEntryQtyAction}
            className="flex items-center gap-1"
            onSubmit={(ev) => {
              const fd = new FormData(ev.currentTarget);
              const q = parseFloat(String(fd.get('qty') || '0'));
              if (Number.isFinite(q) && q > 0) onQtyOptimistic(e.id, q);
            }}
          >
            <input type="hidden" name="date" value={selectedYMD} />
            <input type="hidden" name="entry_id" value={e.id} />
            <label htmlFor={`qty-${e.id}`} className="sr-only">
              Quantity
            </label>
            <input
              key={`${e.id}-${e.qty}`}
              id={`qty-${e.id}`}
              name="qty"
              type="number"
              step="any"
              min="0"
              inputMode="decimal"
              defaultValue={String(e.qty)}
              className="w-20 border rounded px-2 py-1 text-xs"
            />
            <span>{e.unit}</span>
            <button
              type="submit"
              className="rounded border px-2 py-1 text-xs hover:bg-gray-50"
              title="Save quantity"
            >
              Save
            </button>
            <RefreshOnActionComplete />
          </form>

          <span aria-hidden="true">•</span>

          {/* Status segmented control */}
          <div className="inline-flex overflow-hidden rounded border">
            {e.status === 'planned' ? (
              <>
                <span className="px-2 py-0.5 bg-slate-200 text-slate-900 font-medium select-none">
                  Planned
                </span>
                <form
                  action={toggleEntryStatusAction}
                  onSubmit={() => onStatusOptimistic(e.id, 'eaten')}
                >
                  <input type="hidden" name="date" value={selectedYMD} />
                  <input type="hidden" name="entry_id" value={e.id} />
                  <input type="hidden" name="next_status" value="eaten" />
                  <button type="submit" className="px-2 py-0.5 hover:bg-gray-50" title="Mark as eaten">
                    Eaten
                  </button>
                  <RefreshOnActionComplete />
                </form>
              </>
            ) : (
              <>
                <form
                  action={toggleEntryStatusAction}
                  onSubmit={() => onStatusOptimistic(e.id, 'planned')}
                >
                  <input type="hidden" name="date" value={selectedYMD} />
                  <input type="hidden" name="entry_id" value={e.id} />
                  <input type="hidden" name="next_status" value="planned" />
                  <button type="submit" className="px-2 py-0.5 hover:bg-gray-50" title="Mark as planned">
                    Planned
                  </button>
                  <RefreshOnActionComplete />
                </form>
                <span className="px-2 py-0.5 bg-slate-200 text-slate-900 font-medium select-none">
                  Eaten
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 pl-2">
        <div className="text-sm">{Number(e.kcal_snapshot).toFixed(2)} kcal</div>
        <DeleteEntryButton entryId={e.id} date={selectedYMD} />
      </div>
    </li>
  );
}

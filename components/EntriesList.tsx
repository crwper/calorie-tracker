// components/EntriesList.tsx
'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
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
import { useFormStatus } from 'react-dom';

type Entry = {
  id: string;
  name: string;
  qty: string;
  unit: string;
  kcal_snapshot: number;
  status: 'planned' | 'eaten';
  created_at: string;
};

/* Mounted guard to avoid SSR/CSR attribute mismatches on the drag handle */
function useIsMounted() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}

// Debounce a form.requestSubmit() call
function useDebouncedSubmit(delay = 600) {
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  return (form: HTMLFormElement) => {
    if (t.current) clearTimeout(t.current);
    t.current = setTimeout(() => {
      form.requestSubmit();
    }, delay);
  };
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
  const mounted = useIsMounted();
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
      className={`p-2 flex gap-2 rounded-md ${
        e.status === 'planned' ? 'bg-amber-50 border-l-4 border-amber-400' : ''
      }`}
    >
      {/* Drag handle */}
      <div className="shrink-0 pt-1">
        <button
          type="button"
          aria-label="Drag to reorder"
          role="button"
          className="rounded border px-2 py-1 text-xs cursor-grab active:cursor-grabbing select-none bg-white disabled:opacity-60 flex items-center justify-center touch-none"
          {...(mounted ? attributes : {})}
          {...(mounted ? listeners : {})}
          suppressHydrationWarning
          disabled={disabled}
        >
          ≡
        </button>
      </div>

      {/* Content grid: TL name, TR kcal+delete, BL qty+toggle, BR saving... */}
      <div className="flex-1">
        <div className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-1">
          {/* Top-left: description */}
          <div className="col-[1/2] row-[1/2]">
            <div className="font-medium">{e.name}</div>
          </div>

          {/* Top-right: kcal + delete */}
          <div className="col-[2/3] row-[1/2] flex items-center gap-3 justify-end">
            <div className="text-sm">{Number(e.kcal_snapshot).toFixed(2)} kcal</div>
            <DeleteEntryButton entryId={e.id} date={selectedYMD} />
          </div>

          {/* Bottom row: left = qty + toggle; right = Saving… (absolute) */}
          <div className="col-span-2 relative mt-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600 pr-16">
              {/* Qty editor — auto-save; no +/- buttons */}
              <AutoSaveQtyForm
                entryId={e.id}
                unit={e.unit}
                initialQty={e.qty}
                selectedYMD={selectedYMD}
                onQtyOptimistic={(q) => onQtyOptimistic(e.id, q)}
              />

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
                      {/* Saving indicator sits bottom-right for this form too */}
                      <SavingDot className="absolute right-0 bottom-0" />
                      <RefreshOnActionComplete debounceMs={250} />
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
                      {/* Same absolute position; whichever form is pending will show */}
                      <SavingDot className="absolute right-0 bottom-0" />
                      <RefreshOnActionComplete debounceMs={250} />
                    </form>
                    <span className="px-2 py-0.5 bg-slate-200 text-slate-900 font-medium select-none">
                      Eaten
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}

/* ----- Auto-save qty sub-component (native spinner only) ----- */
function AutoSaveQtyForm({
  entryId,
  unit,
  initialQty,
  selectedYMD,
  onQtyOptimistic,
}: {
  entryId: string;
  unit: string;
  initialQty: string;
  selectedYMD: string;
  onQtyOptimistic: (qty: number) => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [val, setVal] = useState(initialQty);
  const debouncedSubmit = useDebouncedSubmit(600);

  // Keep input in sync when server refresh replaces props
  useEffect(() => {
    setVal(initialQty);
  }, [initialQty]);

  function parseQty(v: string): number | null {
    const n = parseFloat(v);
    if (!Number.isFinite(n) || n <= 0) return null;
    return n;
  }

  function commit(next: number, mode: 'debounced' | 'immediate') {
    onQtyOptimistic(next); // update kcal immediately
    const form = formRef.current;
    if (!form) return;
    const input = form.elements.namedItem('qty') as HTMLInputElement | null;
    if (input) input.value = String(next);
    if (mode === 'immediate') {
      form.requestSubmit();
    } else {
      debouncedSubmit(form);
    }
  }

  return (
    <form
      ref={formRef}
      action={updateEntryQtyAction}
      className="flex items-center gap-1"
      onSubmit={(ev) => {
        // Enter key submits; keep optimistic in sync
        const fd = new FormData(ev.currentTarget);
        const q = parseFloat(String(fd.get('qty') || '0'));
        if (Number.isFinite(q) && q > 0) onQtyOptimistic(q);
      }}
    >
      <input type="hidden" name="date" value={selectedYMD} />
      <input type="hidden" name="entry_id" value={entryId} />
      <label htmlFor={`qty-${entryId}`} className="sr-only">
        Quantity
      </label>
      <input
        id={`qty-${entryId}`}
        name="qty"
        type="number"
        step="any"
        min="0"
        inputMode="decimal"
        value={val}
        onInput={(e) => {
          const nextStr = e.currentTarget.value;
          setVal(nextStr);
          const n = parseQty(nextStr);
          if (n != null) commit(n, 'debounced');
        }}
        onBlur={(e) => {
          const n = parseQty(e.currentTarget.value);
          if (n != null) {
            commit(n, 'immediate');
          } else {
            setVal(initialQty);
          }
        }}
        className="w-20 border rounded px-2 py-1 text-xs"
      />
      <span>{unit}</span>
      {/* Bottom-right Saving… (relative parent is the bottom row container) */}
      <SavingDot className="absolute right-0 bottom-0" />
      <RefreshOnActionComplete debounceMs={250} />
    </form>
  );
}

function SavingDot({ className = '' }: { className?: string }) {
  const { pending } = useFormStatus();
  return (
    <span
      className={`text-[11px] text-gray-500 ${className}`}
      aria-live="polite"
      aria-atomic="true"
    >
      {pending ? 'Saving…' : ''}
    </span>
  );
}

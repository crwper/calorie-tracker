// components/EntriesList.tsx
'use client';

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  forwardRef,
  useImperativeHandle,
} from 'react';
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

/* Probe pending state of the nearest <form> and lift it up */
function FormPendingProbe({ onChange }: { onChange: (p: boolean) => void }) {
  const { pending } = useFormStatus();
  useEffect(() => onChange(pending), [pending, onChange]);
  return null;
}

/* Keep indicator visible briefly after last pending turns false */
function useStickyBoolean(on: boolean, minOnMs = 250) {
  const [vis, setVis] = useState(false);
  const timer = useRef<number | null>(null);
  useEffect(() => {
    if (on) {
      if (timer.current) { clearTimeout(timer.current); timer.current = null; }
      setVis(true);
    } else {
      if (timer.current) clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        setVis(false);
        timer.current = null;
      }, minOnMs);
    }
    return () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } };
  }, [on, minOnMs]);
  return vis;
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

  // Row-level pending from qty + checkbox (stable across optimistic UI)
  const [qtyPending, setQtyPending] = useState(false);
  const [statusPending, setStatusPending] = useState(false);
  const showSaving = useStickyBoolean(qtyPending || statusPending, 250);

  // Expose an imperative "commitNow" on qty form so we can flush before toggle->eaten
  const qtyRef = useRef<AutoSaveQtyFormHandle | null>(null);

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`p-2 flex items-stretch gap-2 rounded-md ${
        // ✅ Completed rows softened; no special styling for planned rows.
        e.status === 'eaten' ? 'opacity-70' : ''
      }`}
    >
      {/* Drag handle: full-height left edge */}
      <div className="shrink-0 self-stretch">
        <button
          type="button"
          aria-label="Drag to reorder"
          role="button"
          className="h-full w-4 md:w-[18px] flex items-center justify-center cursor-grab active:cursor-grabbing select-none touch-none bg-transparent disabled:opacity-60 outline-none focus:outline-none"
          {...(mounted ? attributes : {})}
          {...(mounted ? listeners : {})}
          suppressHydrationWarning
          disabled={disabled}
        >
          <span aria-hidden="true" className="text-gray-400">≡</span>
        </button>
      </div>

      {/* Checkbox column (centered vertically, toned down styling) */}
      <div className="shrink-0 w-8 flex items-center justify-center">
        <CheckboxStatusForm
          entryId={e.id}
          currentStatus={e.status}
          selectedYMD={selectedYMD}
          onSubmitOptimistic={(next) => onStatusOptimistic(e.id, next)}
          onPendingChange={setStatusPending}
          onPreSubmit={() => qtyRef.current?.commitNow()}
        />
      </div>

      {/* Content grid: TL name, TR kcal+delete, BL qty, BR saving… */}
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

          {/* Bottom row container (relative for bottom-right indicator) */}
          <div className="col-span-2 relative mt-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600 pr-16">
              {/* Bottom-left: Qty — editable when planned; text-only when eaten (form stays mounted) */}
              <AutoSaveQtyForm
                ref={qtyRef}
                entryId={e.id}
                unit={e.unit}
                initialQty={e.qty}
                selectedYMD={selectedYMD}
                onQtyOptimistic={(q) => onQtyOptimistic(e.id, q)}
                onPendingChange={setQtyPending}
                readOnly={e.status === 'eaten'}
              />
            </div>

            {/* Bottom-right: row-level Saving… indicator (covers qty or status) */}
            {showSaving && (
              <span
                className="absolute right-0 bottom-0 text-[11px] text-gray-500"
                aria-live="polite"
                aria-atomic="true"
              >
                Saving…
              </span>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

/* ----- Auto-save qty sub-component (native spinner only) ----- */

export type AutoSaveQtyFormHandle = { commitNow: () => void };

const AutoSaveQtyForm = forwardRef<AutoSaveQtyFormHandle, {
  entryId: string;
  unit: string;
  initialQty: string;
  selectedYMD: string;
  onQtyOptimistic: (qty: number) => void;
  onPendingChange: (p: boolean) => void;
  readOnly?: boolean;
}>(function AutoSaveQtyForm(
  { entryId, unit, initialQty, selectedYMD, onQtyOptimistic, onPendingChange, readOnly = false },
  ref
) {
  const formRef = useRef<HTMLFormElement>(null);
  const [val, setVal] = useState(initialQty);
  const debouncedSubmit = useDebouncedSubmit(600);

  // Keep input in sync when server refresh replaces props
  useEffect(() => {
    setVal(initialQty);
  }, [initialQty]);

  // Safety: if this form ever unmounts, clear pending state so the row indicator can't stick
  useEffect(() => {
    return () => onPendingChange(false);
  }, [onPendingChange]);

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

  // Expose "commitNow" so parent can flush before toggling to eaten
  useImperativeHandle(ref, () => ({
    commitNow: () => {
      const n = parseQty(val);
      if (n != null) commit(n, 'immediate');
    },
  }), [val]);

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
      {readOnly ? (
        <>
          {/* Text-only when eaten */}
          <span className="font-medium">{val}</span>
          <span>{unit}</span>
          {/* Keep a hidden qty field so the form instance stays stable and commitNow can still set it */}
          <input name="qty" value={val} readOnly hidden aria-hidden="true" />
        </>
      ) : (
        <>
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
        </>
      )}
      <FormPendingProbe onChange={onPendingChange} />
      <RefreshOnActionComplete debounceMs={250} />
    </form>
  );
});

/* ----- Checkbox status form (neutral/toned-down) ----- */
function CheckboxStatusForm({
  entryId,
  currentStatus,
  selectedYMD,
  onSubmitOptimistic,
  onPendingChange,
  onPreSubmit,
}: {
  entryId: string;
  currentStatus: 'planned' | 'eaten';
  selectedYMD: string;
  onSubmitOptimistic: (next: 'planned' | 'eaten') => void;
  onPendingChange: (p: boolean) => void;
  onPreSubmit: () => void; // flush qty before toggling
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const nextRef = useRef<HTMLInputElement>(null);
  const targetRef = useRef<'planned' | 'eaten'>(currentStatus);

  // Keep next target aligned if the server refresh changes currentStatus
  useEffect(() => {
    targetRef.current = currentStatus;
    if (nextRef.current) nextRef.current.value = currentStatus;
  }, [currentStatus]);

  return (
    <form
      ref={formRef}
      action={toggleEntryStatusAction}
      className="inline-flex items-center justify-center"
      onSubmit={() => onSubmitOptimistic(targetRef.current)}
    >
      <input type="hidden" name="date" value={selectedYMD} />
      <input type="hidden" name="entry_id" value={entryId} />
      <input ref={nextRef} type="hidden" name="next_status" value={currentStatus} />

      <input
        id={`eaten-${entryId}`}
        type="checkbox"
        className="
          h-4 w-4 cursor-pointer
          border border-gray-300 rounded
          accent-gray-500
          outline-none focus:ring-2 focus:ring-gray-300
        "
        aria-label="Eaten"
        title={currentStatus === 'eaten' ? 'Mark as planned' : 'Mark as eaten'}
        checked={currentStatus === 'eaten'}
        onChange={(e) => {
          // Flush qty if needed, then submit with the new target status
          onPreSubmit();
          const next = e.currentTarget.checked ? 'eaten' : 'planned';
          targetRef.current = next;
          if (nextRef.current) nextRef.current.value = next;
          formRef.current?.requestSubmit();
        }}
      />

      <FormPendingProbe onChange={onPendingChange} />
      <RefreshOnActionComplete debounceMs={250} />
    </form>
  );
}

// components/EntriesList.tsx
'use client';

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  forwardRef,
  useImperativeHandle,
  useCallback,
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
  updateEntryQtyAndStatusAction,
} from '@/app/actions';
import DeleteButton from '@/components/primitives/DeleteButton';
import { deleteEntryAction } from '@/app/actions';
import DataList from '@/components/primitives/DataList';
import ListRow from '@/components/primitives/ListRow';
import Grip from '@/components/icons/Grip';
import { markLocalWrite } from '@/components/realtime/localWritePulse';
import {
  registerPendingOp,
  subscribeToPending,
  hasPendingForEntry,
} from '@/components/realtime/opRegistry';

export type Entry = {
  id: string;
  name: string;
  qty: string;
  unit: string;
  kcal_snapshot: number;
  status: 'planned' | 'eaten';
  created_at: string;
  kcal_per_unit_snapshot?: number | null;
};

type EntryAddedListener = (entry: Entry) => void;
const entryAddedListeners = new Set<EntryAddedListener>();

export function subscribeToEntryAdds(listener: EntryAddedListener): () => void {
  entryAddedListeners.add(listener);
  return () => {
    entryAddedListeners.delete(listener);
  };
}

export function emitEntryAdded(entry: Entry): void {
  for (const listener of entryAddedListeners) {
    listener(entry);
  }
}

/* Mounted guard to avoid SSR/CSR attribute mismatches on the drag handle */
function useIsMounted() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}

// Debounce a form.requestSubmit() call
function useDebouncedSubmit(delay = 600) {
  const t = useRef<number | null>(null);

  // beforeSubmit(opId) will be called right before requestSubmit()
  const submit = (
    form: HTMLFormElement,
    beforeSubmit: (opId: string) => void
  ) => {
    if (t.current) window.clearTimeout(t.current);
    t.current = window.setTimeout(() => {
      const opId = crypto.randomUUID();
      beforeSubmit(opId);
      form.requestSubmit();
      t.current = null;
    }, delay);
  };

  const cancel = () => {
    if (t.current) {
      window.clearTimeout(t.current);
      t.current = null;
    }
  };

  return { submit, cancel };
}

/* Keep indicator visible briefly after last pending turns false */
function useStickyBoolean(on: boolean, minOnMs = 250) {
  const [vis, setVis] = useState(false);
  const timer = useRef<number | null>(null);
  useEffect(() => {
    if (on) {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      setVis(true);
    } else {
      if (timer.current) clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        setVis(false);
        timer.current = null;
      }, minOnMs);
    }
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
    };
  }, [on, minOnMs]);
  return vis;
}

/**
 * Track whether there is any pending op in the registry that touches this entry id.
 * Used to drive row-level "Saving…" without wiring directly to useFormStatus.
 */
function useEntryPending(entryId: string): boolean {
  const [pending, setPending] = useState(() => hasPendingForEntry(entryId));

  useEffect(() => {
    const update = () => {
      setPending(hasPendingForEntry(entryId));
    };

    // Initial check in case something is already pending for this id.
    update();

    const unsubscribe = subscribeToPending(update);
    return () => {
      unsubscribe();
    };
  }, [entryId]);

  return pending;
}

export default function EntriesList({
  entries,
  selectedYMD,
  activeGoalKcal,
}: {
  entries: Entry[];
  selectedYMD: string;
  /** Optional kcal/day goal for this date (used for the summary line). */
  activeGoalKcal?: number | null;
}) {
  const [items, setItems] = useState(entries);
  const [saving, setSaving] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    setItems(entries);
  }, [entries]);

  useEffect(() => {
    const unsubscribe = subscribeToEntryAdds((entry) => {
      setItems((prev) => [...prev, entry]);
    });
    return unsubscribe;
  }, []);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
  );

  async function persistOrder(next: Entry[], prev: Entry[]) {
    try {
      setSaving(true);

      const opId = crypto.randomUUID();
      registerPendingOp({
        id: opId,
        kind: 'reorder',
        entryIds: next.map((e) => e.id),
        startedAt: Date.now(),
      });

      await reorderEntriesAction({
        date: selectedYMD,
        ids: next.map((e) => e.id),
        client_op_id: opId,
      });

      // De-dupe echo for this tab (legacy TTL path still fine)
      markLocalWrite();
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

        // Prefer the canonical per-unit snapshot if we have it
        let perUnit =
          it.kcal_per_unit_snapshot != null
            ? Number(it.kcal_per_unit_snapshot)
            : undefined;

        // Fallback for very old rows that don't have a snapshot yet:
        if (perUnit == null) {
          const baseQty = parseFloat(String(it.qty)) || 0;
          const baseKcal = Number(it.kcal_snapshot) || 0;
          if (baseQty > 0 && Number.isFinite(baseKcal)) {
            perUnit = Number((baseKcal / baseQty).toFixed(4));
          }
        }

        if (perUnit == null || !Number.isFinite(perUnit) || perUnit <= 0) {
          // Give up on kcal optimism, but still update the qty text
          return {
            ...it,
            qty: String(newQty),
          };
        }

        const nextKcal = Number((perUnit * newQty).toFixed(2));

        return {
          ...it,
          qty: String(newQty),
          kcal_snapshot: nextKcal,
          // Freeze the per-unit so future edits don't re-derive it
          kcal_per_unit_snapshot: perUnit,
        };
      })
    );
  }

  function applyStatusOptimistic(id: string, next: 'planned' | 'eaten') {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, status: next } : it)));
  }

  function handleEntryDeleted(id: string) {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }

  if (items.length === 0) {
    return (
      <DataList>
        <li className="py-2 text-sm text-muted-foreground">No entries yet.</li>
      </DataList>
    );
  }

  const disableDnD = saving || isPending;

  // Derive totals from the optimistic local items
  const { totalPlanned, totalEaten } = items.reduce(
    (acc, it) => {
      if (it.status === 'planned') acc.totalPlanned += it.kcal_snapshot;
      else if (it.status === 'eaten') acc.totalEaten += it.kcal_snapshot;
      return acc;
    },
    { totalPlanned: 0, totalEaten: 0 }
  );

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={items.map((e) => e.id)} strategy={verticalListSortingStrategy}>
          <DataList>
            {items.map((e) => (
              <SortableEntry
                key={e.id}
                e={e}
                selectedYMD={selectedYMD}
                disabled={disableDnD}
                onQtyOptimistic={applyQtyOptimistic}
                onStatusOptimistic={applyStatusOptimistic}
                onDeleteOptimistic={handleEntryDeleted}
              />
            ))}
          </DataList>
        </SortableContext>
      </DndContext>

      {/* Totals + optional goal, based on local optimistic state */}
      <div className="space-y-1">
        <div className="pt-3 mt-2 border-t text-sm flex items-center justify-between">
          <div>
            <span className="font-medium">Planned:</span> {totalPlanned.toFixed(2)} kcal
          </div>
          <div>
            <span className="font-medium">Eaten:</span> {totalEaten.toFixed(2)} kcal
          </div>
          <div>
            <span className="font-medium">Total:</span> {(totalPlanned + totalEaten).toFixed(2)} kcal
          </div>
        </div>

        {activeGoalKcal != null && (
          <div className="text-sm flex items-center justify-end leading-tight">
            Goal:&nbsp;
            <span className="font-medium tabular-nums">{activeGoalKcal}</span>
            &nbsp;kcal
          </div>
        )}
      </div>
    </>
  );
}

/* ---- Single sortable row ---- */

function SortableEntry({
  e,
  selectedYMD,
  disabled,
  onQtyOptimistic,
  onStatusOptimistic,
  onDeleteOptimistic,
}: {
  e: Entry;
  selectedYMD: string;
  disabled?: boolean;
  onQtyOptimistic: (id: string, qty: number) => void;
  onStatusOptimistic: (id: string, next: 'planned' | 'eaten') => void;
  onDeleteOptimistic: (id: string) => void;
}) {
  const mounted = useIsMounted();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: e.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  const entryPending = useEntryPending(e.id);
  const showSaving = useStickyBoolean(entryPending, 250);

  const qtyRef = useRef<AutoSaveQtyFormHandle | null>(null);

  return (
    <ListRow
      ref={setNodeRef}
      style={style}
      handle={
        <button
          type="button"
          aria-label="Drag to reorder"
          className="h-full w-4 md:w-[18px] flex items-center justify-center cursor-grab active:cursor-grabbing select-none touch-none bg-control disabled:opacity-60 outline-none focus:outline-none"
          {...(mounted ? attributes : {})}
          {...(mounted ? listeners : {})}
          suppressHydrationWarning
          disabled={disabled}
        >
          <Grip />
        </button>
      }
      content={
        <div className="grid grid-cols-[22px_1fr_auto] gap-x-2 gap-y-0">
          {/* Col 1: checkbox spans both rows */}
          <div className="col-[1/2] row-span-2 flex items-center justify-center">
            <CheckboxStatusForm
              entryId={e.id}
              currentStatus={e.status}
              selectedYMD={selectedYMD}
              initialQtyStr={e.qty}
              getLatestQty={() => qtyRef.current?.getLatestQty() ?? null}
              onSubmitOptimistic={(next) => onStatusOptimistic(e.id, next)}
              onPreSubmit={() => qtyRef.current?.cancelPending()}
            />
          </div>

          {/* Row 1 / Col 2: name */}
          <div className="col-[2/3] row-[1/2]">
            <div className="font-medium">{e.name}</div>
          </div>

          {/* Row 1 / Col 3: kcal */}
          <div className="col-[3/4] row-[1/2] flex items-center justify-end">
            <div className="text-sm">{Number(e.kcal_snapshot).toFixed(2)} kcal</div>
          </div>

          {/* Row 2 / Col 2: qty editor */}
          <div className="col-[2/3] row-[2/3] mt-0.5">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <AutoSaveQtyForm
                ref={qtyRef}
                entryId={e.id}
                unit={e.unit}
                initialQty={e.qty}
                selectedYMD={selectedYMD}
                onQtyOptimistic={(q) => onQtyOptimistic(e.id, q)}
                readOnly={e.status === 'eaten'}
              />
            </div>
          </div>

          {/* Row 2 / Col 3: Saving… indicator (space is reserved even when hidden) */}
          <div className="col-[3/4] row-[2/3] mt-0.5 flex items-center justify-end">
            <span
              className={`text-[11px] text-subtle-foreground whitespace-nowrap ${showSaving ? '' : 'invisible'}`}
              aria-live="polite"
              aria-atomic="true"
            >
              Saving…
            </span>
          </div>
        </div>
      }
      actions={
        <EntryDeleteForm
          entryId={e.id}
          selectedYMD={selectedYMD}
          onDeleted={() => onDeleteOptimistic(e.id)}
        />
      }
    />
  );
}

function EntryDeleteForm({
  entryId,
  selectedYMD,
  onDeleted,
}: {
  entryId: string;
  selectedYMD: string;
  onDeleted: () => void;
}) {
  const clientOpInputRef = useRef<HTMLInputElement | null>(null);

  const handleSubmit = () => {
    // Let the form submit normally, but stamp + register op-id first.
    const opId = crypto.randomUUID();
    if (clientOpInputRef.current) {
      clientOpInputRef.current.value = opId;
    }
    registerPendingOp({
      id: opId,
      kind: 'delete',
      entryIds: [entryId],
      startedAt: Date.now(),
    });

    // Remove the row optimistically from local state.
    onDeleted();
    // no preventDefault: we want the submission to go ahead
  };

  return (
    <form onSubmit={handleSubmit}>
      <input type="hidden" name="entry_id" value={entryId} />
      <input type="hidden" name="date" value={selectedYMD} />
      <input
        ref={clientOpInputRef}
        type="hidden"
        name="client_op_id"
        defaultValue=""
      />
      <DeleteButton
        formAction={deleteEntryAction}
        inlineInParentForm
        title="Delete entry"
        aria-label="Delete entry"
        confirmMessage="Delete this entry?"
        withRefresh={false}   // no auto router.refresh; EntriesList handles UI optimistically
      />
    </form>
  );
}

/* ----- Auto-save qty sub-component (native spinner only) ----- */

export type AutoSaveQtyFormHandle = {
  commitNow: () => void;
  getLatestQty: () => number | null;
  cancelPending: () => void;
};

const AutoSaveQtyForm = forwardRef<AutoSaveQtyFormHandle, {
  entryId: string;
  unit: string;
  initialQty: string;
  selectedYMD: string;
  onQtyOptimistic: (qty: number) => void;
  readOnly?: boolean;
}>(function AutoSaveQtyForm(
  { entryId, unit, initialQty, selectedYMD, onQtyOptimistic, readOnly = false },
  ref
) {
  const formRef = useRef<HTMLFormElement>(null);
  const [val, setVal] = useState(initialQty);
  const { submit: debouncedSubmit, cancel: cancelDebounce } = useDebouncedSubmit(600);
  const clientOpInputRef = useRef<HTMLInputElement | null>(null);

  // Keep input in sync when server refresh replaces props
  useEffect(() => {
    setVal(initialQty);
  }, [initialQty]);

  // make it stable
  const parseQty = useCallback((v: string): number | null => {
    const n = parseFloat(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, []);

  // make it stable
  const commit = useCallback(
    (next: number, mode: 'debounced' | 'immediate') => {
      onQtyOptimistic(next);
      const form = formRef.current;
      if (!form) return;

      const applyOpId = (opId: string) => {
        if (clientOpInputRef.current) {
          clientOpInputRef.current.value = opId;
        }
        registerPendingOp({
          id: opId,
          kind: 'update_qty',
          entryIds: [entryId],
          startedAt: Date.now(),
        });
        const input = form.elements.namedItem('qty') as HTMLInputElement | null;
        if (input) input.value = String(next);
      };

      if (mode === 'immediate') {
        // Make sure no old debounced submit is still queued
        cancelDebounce();
        const opId = crypto.randomUUID();
        applyOpId(opId);
        form.requestSubmit();
      } else {
        debouncedSubmit(form, (opId) => {
          applyOpId(opId);
        });
      }
    },
    [onQtyOptimistic, debouncedSubmit, cancelDebounce, entryId]
  );

  // Expose "commitNow" so parent can flush before toggling to eaten
  useImperativeHandle(
    ref,
    () => ({
      commitNow: () => {
        const n = parseQty(val);
        if (n != null) commit(n, 'immediate');
      },
      getLatestQty: () => {
        const n = parseQty(val);
        return n;
      },
      cancelPending: () => {
        cancelDebounce();
      },
    }),
    [val, parseQty, commit, cancelDebounce]
  );

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
      <input
        ref={clientOpInputRef}
        type="hidden"
        name="client_op_id"
        defaultValue=""
      />
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
    </form>
  );
});

/* ----- Checkbox status form (neutral/toned-down) ----- */
function CheckboxStatusForm({
  entryId,
  currentStatus,
  selectedYMD,
  initialQtyStr,
  getLatestQty,
  onSubmitOptimistic,
  onPreSubmit,
}: {
  entryId: string;
  currentStatus: 'planned' | 'eaten';
  selectedYMD: string;
  /** string form of qty from props, used as fallback initial hidden value */
  initialQtyStr: string;
  /** read the latest typed qty from the sibling qty editor */
  getLatestQty?: () => number | null;
  onSubmitOptimistic: (next: 'planned' | 'eaten') => void;
  onPreSubmit: () => void; // flush qty before toggling
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const nextRef = useRef<HTMLInputElement>(null);
  const qtyRef = useRef<HTMLInputElement>(null);
  const targetRef = useRef<'planned' | 'eaten'>(currentStatus);
  const clientOpInputRef = useRef<HTMLInputElement | null>(null);

  // Keep next target aligned if the server refresh changes currentStatus
  useEffect(() => {
    targetRef.current = currentStatus;
    if (nextRef.current) nextRef.current.value = currentStatus;
  }, [currentStatus]);

  return (
    <form
      ref={formRef}
      action={updateEntryQtyAndStatusAction}
      className="inline-flex items-center justify-center"
      onSubmit={() => onSubmitOptimistic(targetRef.current)}
    >
      <input type="hidden" name="date" value={selectedYMD} />
      <input type="hidden" name="entry_id" value={entryId} />
      <input ref={nextRef} type="hidden" name="next_status" value={currentStatus} />
      <input ref={qtyRef} type="hidden" name="qty" />
      <input
        ref={clientOpInputRef}
        type="hidden"
        name="client_op_id"
        defaultValue=""
      />

      <input
        id={`eaten-${entryId}`}
        type="checkbox"
        className="
          h-4 w-4 cursor-pointer
          border border-input rounded
          accent-control-accent
          outline-none focus:ring-2 focus:ring-control-ring
        "
        aria-label="Eaten"
        title={currentStatus === 'eaten' ? 'Mark as planned' : 'Mark as eaten'}
        checked={currentStatus === 'eaten'}
        onChange={(e) => {
          // Cancel any pending qty debounce; we will send qty ourselves
          onPreSubmit();
          const next = e.currentTarget.checked ? 'eaten' : 'planned';
          targetRef.current = next;
          if (nextRef.current) nextRef.current.value = next;

          // Read latest qty and fill the hidden input (fallback to initial)
          const latest = getLatestQty ? getLatestQty() : null;
          if (qtyRef.current) {
            qtyRef.current.value =
              latest != null ? String(latest) : String(initialQtyStr);
          }

          const opId = crypto.randomUUID();
          if (clientOpInputRef.current) {
            clientOpInputRef.current.value = opId;
          }
          registerPendingOp({
            id: opId,
            kind: 'update_qty_and_status',
            entryIds: [entryId],
            startedAt: Date.now(),
          });

          formRef.current?.requestSubmit();
        }}
      />
    </form>
  );
}

// components/CatalogRow.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import RefreshOnActionComplete from '@/components/RefreshOnActionComplete';
import ListRow from '@/components/primitives/ListRow';
import DeleteButton from '@/components/primitives/DeleteButton';
import { deleteCatalogItemAction } from '@/app/catalog/actions';
import { useFormStatus } from 'react-dom';

type Item = {
  id: string;
  name: string;
  unit: string;
  kcal_per_unit: number | string;
  default_qty: number | string;
  created_at: string;
};

export default function CatalogRow({
  item,
  updateAction,
}: {
  item: Item;
  // Server Action passed down from the Server Component (page)
  updateAction: (formData: FormData) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const defaultQty = Number(item.default_qty ?? 0);
  const perUnit = Number(item.kcal_per_unit ?? 0);
  const approxKcal = Number.isFinite(defaultQty * perUnit)
    ? (defaultQty * perUnit).toFixed(2)
    : '';

  if (editing) {
    return (
      <li className="py-2">
        <EditRow
          item={item}
          updateAction={updateAction}
          onDone={() => setEditing(false)}
          onCancel={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    <ViewRow
      item={item}
      approxKcal={approxKcal}
      onEdit={() => setEditing(true)}
    />
  );
}

/* ---------- View row (clean, scannable) ---------- */

function ViewRow({
  item,
  approxKcal,
  onEdit,
}: {
  item: Item;
  approxKcal: string;
  onEdit: () => void;
}) {
  const defaultQty = Number(item.default_qty ?? 0);
  const perUnit = Number(item.kcal_per_unit ?? 0);

  return (
    <ListRow
      handle={null}
      content={
        <div className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-1">
          <div>
            <div className="font-medium">{item.name}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {defaultQty.toString()} {item.unit} · {perUnit} kcal/{item.unit}
              {approxKcal ? <> &nbsp;≈&nbsp;<span className="tabular-nums">{approxKcal}</span> kcal</> : null}
            </div>
          </div>
          <div className="flex items-center justify-end">
            <div className="text-sm font-medium tabular-nums">
              {/* optional: right-side emphasis; keep or remove as you prefer */}
            </div>
          </div>
        </div>
      }
      actions={
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onEdit}
            aria-label="Edit item"
            title="Edit item"
            className="inline-flex h-7 w-7 items-center justify-center hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-slate-300 rounded"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
            </svg>
          </button>
          <DeleteButton
            formAction={deleteCatalogItemAction}
            hidden={{ id: item.id }}
            title="Delete item"
            aria-label="Delete item"
            confirmMessage="Delete this catalog item? (Past entries remain unchanged)"
            withRefresh={250}
          />
        </div>
      }
    />
  );
}

/* ---------- Edit row (grid aligned with "Add item") ---------- */

// Exit edit mode after a successful submit settles
function PendingWatcher({ onSettled }: { onSettled: () => void }) {
  const { pending } = useFormStatus();
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending) {
      onSettled();
    }
    wasPending.current = pending;
  }, [pending, onSettled]);
  return null;
}

function EditRow({
  item,
  updateAction,
  onDone,
  onCancel,
}: {
  item: Item;
  updateAction: (formData: FormData) => Promise<void>;
  onDone: () => void;
  onCancel: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={updateAction}
      className="
        grid gap-2 items-end
        grid-cols-2
        md:grid-cols-[2fr_1fr_1fr_1fr_1fr]
      "
    >
      <input type="hidden" name="id" value={item.id} />

      <div className="col-span-2 md:col-span-2 min-w-0">
        <label className="text-xs text-muted-foreground">Name</label>
        <input
          name="name"
          defaultValue={item.name}
          className="w-full min-w-0 border rounded px-2 py-1 text-sm"
        />
      </div>

      <div>
        <label className="text-xs text-muted-foreground">Unit</label>
        <input
          name="unit"
          defaultValue={item.unit}
          className="w-full border rounded px-2 py-1 text-sm"
        />
      </div>

      <div>
        <label className="text-xs text-muted-foreground">kcal / unit</label>
        <input
          name="kcal_per_unit"
          type="number"
          step="any"
          min="0"
          inputMode="decimal"
          defaultValue={String(item.kcal_per_unit)}
          className="w-full border rounded px-2 py-1 text-sm"
        />
      </div>

      <div>
        <label className="text-xs text-muted-foreground">Default qty</label>
        <input
          name="default_qty"
          type="number"
          step="any"
          min="0"
          inputMode="decimal"
          defaultValue={String(item.default_qty)}
          className="w-full border rounded px-2 py-1 text-sm"
        />
      </div>

      {/* Row 2: Save + Cancel, full-width so inputs get max room */}
      <div className="col-span-full flex items-center justify-end gap-1 pt-1">
        <button
          type="submit"
          className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
          title="Save changes"
        >
          Save
        </button>
        <button
          type="button"
          className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
          title="Cancel editing"
          onClick={() => {
            // Reset inputs back to defaults and exit edit mode
            formRef.current?.reset();
            onCancel();
          }}
        >
          Cancel
        </button>
      </div>

      {/* Refresh page data on action settle + leave edit mode */}
      <PendingWatcher onSettled={onDone} />
      <RefreshOnActionComplete debounceMs={250} />
    </form>
  );
}

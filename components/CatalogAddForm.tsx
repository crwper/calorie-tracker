// components/CatalogAddForm.tsx
'use client';

import RefreshOnActionComplete from '@/components/RefreshOnActionComplete';

export default function CatalogAddForm({
  next,
  createAction,
}: {
  next?: string | null;
  createAction: (formData: FormData) => Promise<void>;
}) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <form
        action={createAction}
        className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-2 items-end"
      >
        {next ? <input type="hidden" name="next" value={next} /> : null}

        <div className="col-span-2">
          <label className="text-xs text-gray-600">Name</label>
          <input name="name" className="w-full border rounded px-2 py-1 text-sm" />
        </div>

        <div>
          <label className="text-xs text-gray-600">Unit</label>
          <input
            name="unit"
            className="w-full border rounded px-2 py-1 text-sm"
            placeholder="g"
          />
        </div>

        <div>
          <label className="text-xs text-gray-600">kcal / unit</label>
          <input
            name="kcal_per_unit"
            type="number"
            step="any"
            min="0"
            inputMode="decimal"
            className="w-full border rounded px-2 py-1 text-sm"
            placeholder="3.6"
          />
        </div>

        <div>
          <label className="text-xs text-gray-600">Default qty</label>
          <input
            name="default_qty"
            type="number"
            step="any"
            min="0"
            inputMode="decimal"
            className="w-full border rounded px-2 py-1 text-sm"
            placeholder="130"
          />
        </div>

        <div className="col-span-full flex gap-2">
          <button
            type="submit"
            name="intent"
            value="create"
            className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
          >
            Create
          </button>
          {next && (
            <button
              type="submit"
              name="intent"
              value="create_return"
              className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
              title="Create this item and return to the day you came from"
            >
              Create &amp; return
            </button>
          )}
        </div>

        {/* Because this form lives in a client component, refresh the page data on settle */}
        <RefreshOnActionComplete debounceMs={250} />
      </form>
    </div>
  );
}

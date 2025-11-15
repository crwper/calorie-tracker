// components/GoalAddForm.tsx
'use client';

import RefreshOnActionComplete from '@/components/RefreshOnActionComplete';

export default function GoalAddForm({
  defaultDate,
  next,
  createAction,
}: {
  defaultDate: string;
  next?: string | null;
  createAction: (formData: FormData) => Promise<void>;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <form
        action={createAction}
        className="grid grid-cols-[2fr_1fr] md:grid-cols-[1fr_1fr_1fr_1fr] gap-2 items-end"
      >
        {next ? <input type="hidden" name="next" value={next} /> : null}

        <div>
          <label className="text-xs text-muted-foreground">Start date</label>
          <input
            name="start_date"
            type="date"
            defaultValue={defaultDate}
            className="w-full border rounded px-2 py-1 text-sm"
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground">Target (kcal/day)</label>
          <input
            name="kcal_target"
            type="number"
            min="200"
            max="5000"
            step="1"
            inputMode="numeric"
            className="w-full border rounded px-2 py-1 text-sm"
            placeholder="1350"
          />
        </div>

        <div className="col-span-full">
          <label className="text-xs text-muted-foreground">Note (optional)</label>
          <input
            name="note"
            className="w-full border rounded px-2 py-1 text-sm"
            placeholder="e.g., post-illness adjustment"
          />
        </div>

        <div className="col-span-full flex gap-2">
          <button
            type="submit"
            name="intent"
            value="create"
            className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
          >
            Save
          </button>
          {next && (
            <button
              type="submit"
              name="intent"
              value="create_return"
              className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
              title="Save and return to the day you came from"
            >
              Save &amp; return
            </button>
          )}
        </div>

        <RefreshOnActionComplete debounceMs={250} />
      </form>
    </div>
  );
}

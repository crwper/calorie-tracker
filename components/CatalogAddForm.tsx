// components/CatalogAddForm.tsx
'use client';

import { useState } from 'react';
import RefreshOnActionComplete from '@/components/RefreshOnActionComplete';

function numOrNull(s: string): number | null {
  const n = parseFloat(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export default function CatalogAddForm({
  next,
  createAction,
}: {
  next?: string | null;
  createAction: (formData: FormData) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [labelKcal, setLabelKcal] = useState('');
  const [labelQty, setLabelQty] = useState('');
  const [defaultQty, setDefaultQty] = useState('');

  const labelKcalNum = numOrNull(labelKcal);
  const labelQtyNum = numOrNull(labelQty);
  const perUnit =
    labelKcalNum != null && labelQtyNum != null ? labelKcalNum / labelQtyNum : null;

  const defaultQtyNum = numOrNull(defaultQty);
  const servingKcal =
    perUnit != null && defaultQtyNum != null ? perUnit * defaultQtyNum : null;

  const unitLabel = unit || 'unit';

  return (
    <div className="rounded-lg border bg-card p-4">
      <form
        action={createAction}
        className="grid grid-cols-[2fr_1fr] gap-2 items-end"
      >
        {next ? <input type="hidden" name="next" value={next} /> : null}

        {/* Name + unit */}
        <div>
          <label className="text-xs text-muted-foreground">Name</label>
          <input
            name="name"
            className="w-full border rounded px-2 py-1 text-sm"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground">Unit</label>
          <input
            name="unit"
            className="w-full border rounded px-2 py-1 text-sm"
            placeholder="g, cup, piece…"
            value={unit}
            onChange={(e) => setUnit(e.currentTarget.value)}
          />
        </div>

        {/* Label-style calories */}
        <div>
          <label className="text-xs text-muted-foreground">
            Calories in this amount
          </label>
          <input
            name="label_kcal"
            type="number"
            step="any"
            min="0"
            inputMode="decimal"
            className="w-full border rounded px-2 py-1 text-sm"
            placeholder="e.g., 365"
            value={labelKcal}
            onChange={(e) => setLabelKcal(e.currentTarget.value)}
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground">
            Amount (in your unit)
          </label>
          <input
            name="label_qty"
            type="number"
            step="any"
            min="0"
            inputMode="decimal"
            className="w-full border rounded px-2 py-1 text-sm"
            placeholder="e.g., 100"
            value={labelQty}
            onChange={(e) => setLabelQty(e.currentTarget.value)}
          />
        </div>

        {/* Default serving */}
        <div>
          <label className="text-xs text-muted-foreground">Default serving</label>
          <input
            name="default_qty"
            type="number"
            step="any"
            min="0"
            inputMode="decimal"
            className="w-full border rounded px-2 py-1 text-sm"
            placeholder={unit ? `e.g., 45` : 'e.g., 45'}
            value={defaultQty}
            onChange={(e) => setDefaultQty(e.currentTarget.value)}
          />
        </div>

        {/* Buttons */}
        <div className="col-span-2 flex gap-2">
          <button
            type="submit"
            name="intent"
            value="create"
            className="rounded border px-3 py-1 text-sm hover:bg-control-hover"
          >
            Create
          </button>
          {next && (
            <button
              type="submit"
              name="intent"
              value="create_return"
              className="rounded border px-3 py-1 text-sm hover:bg-control-hover"
              title="Create this item and return to the day you came from"
            >
              Create &amp; return
            </button>
          )}
        </div>

        {/* Preview */}
        <div className="col-span-2 text-xs text-muted-foreground">
          {perUnit != null ? (
            <>
              1 {unitLabel} ≈{' '}
              <span className="tabular-nums">
                {perUnit.toFixed(2)}
              </span>{' '}
              kcal
              {servingKcal != null && (
                <>
                  {' · '}Default:{' '}
                  <span className="tabular-nums">
                    {defaultQtyNum?.toFixed(2)}
                  </span>{' '}
                  {unitLabel} ≈{' '}
                  <span className="tabular-nums">
                    {servingKcal.toFixed(0)}
                  </span>{' '}
                  kcal
                </>
              )}
            </>
          ) : (
            <span>Enter calories and amount to see a preview.</span>
          )}
        </div>

        {/* Because this form lives in a client component, refresh the page data on settle */}
        <RefreshOnActionComplete debounceMs={250} />
      </form>
    </div>
  );
}

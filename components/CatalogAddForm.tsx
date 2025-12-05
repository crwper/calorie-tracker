// components/CatalogAddForm.tsx
'use client';

import { useMemo, useState } from 'react';
import RefreshOnActionComplete from '@/components/RefreshOnActionComplete';
import { parsePositiveNumber } from '@/lib/quantity';

export type CatalogItemFieldsProps = {
  initialName?: string;
  initialUnit?: string;
  initialLabelAmount?: string;
  initialLabelKcal?: string;
  initialDefaultQty?: string;
};

export function CatalogItemFields({
  initialName = '',
  initialUnit = '',
  initialLabelAmount = '',
  initialLabelKcal = '',
  initialDefaultQty = '',
}: CatalogItemFieldsProps) {
  const [name, setName] = useState(initialName);
  const [unit, setUnit] = useState(initialUnit);
  const [labelAmount, setLabelAmount] = useState(initialLabelAmount);
  const [labelKcal, setLabelKcal] = useState(initialLabelKcal);
  const [defaultQty, setDefaultQty] = useState(initialDefaultQty);

  const perUnit = useMemo(() => {
    const amt = parsePositiveNumber(labelAmount);
    const kcal = parsePositiveNumber(labelKcal);
    if (!amt || !kcal) return null;
    return kcal / amt;
  }, [labelAmount, labelKcal]);

  const defaultKcal = useMemo(() => {
    if (perUnit == null) return null;
    const dq = parsePositiveNumber(defaultQty);
    if (!dq) return null;
    return perUnit * dq;
  }, [perUnit, defaultQty]);

  const unitLabel = unit.trim() || 'unit';

  return (
    <>
      {/* Name / description */}
      <div>
        <label className="block text-xs text-muted-foreground">Name</label>
        <input
          name="name"
          required
          className="w-full border rounded px-2 py-1 text-sm"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
        />
      </div>

      {/* From the package */}
      <fieldset className="space-y-2 border rounded px-3 py-2">
        <legend className="text-xs text-muted-foreground px-1">From the package</legend>
        <div className="grid grid-cols-1 sm:grid-cols-[1.1fr_0.9fr_1fr] gap-2 items-end">
          {/* Serving size (amount on package) */}
          <div>
            <label className="block text-xs text-muted-foreground">Serving size</label>
            <input
              name="label_amount"
              type="text"
              inputMode="decimal"
              value={labelAmount}
              onChange={(e) => setLabelAmount(e.currentTarget.value)}
              className="w-full border rounded px-2 py-1 text-sm"
              placeholder="1 or 3/4"
              required
            />
            <p className="mt-1 text-[11px] text-subtle-foreground">e.g., 1, 3/4, 100</p>
          </div>

          {/* Unit (used for both package + default serving) */}
          <div>
            <label className="block text-xs text-muted-foreground">Unit</label>
            <input
              name="unit"
              value={unit}
              onChange={(e) => setUnit(e.currentTarget.value)}
              className="w-full border rounded px-2 py-1 text-sm"
              placeholder="cup"
              required
            />
            <p className="mt-1 text-[11px] text-subtle-foreground">e.g., cup, g, piece</p>
          </div>

          {/* Calories for that serving */}
          <div>
            <label className="block text-xs text-muted-foreground">Calories</label>
            <input
              name="label_kcal"
              type="number"
              step="any"
              min="0"
              inputMode="decimal"
              value={labelKcal}
              onChange={(e) => setLabelKcal(e.currentTarget.value)}
              className="w-full border rounded px-2 py-1 text-sm"
              placeholder="365"
              required
            />
            <p className="mt-1 text-[11px] text-subtle-foreground">kcal for that serving</p>
          </div>
        </div>
      </fieldset>

      {/* Your default serving */}
      <fieldset className="space-y-2 border rounded px-3 py-2">
        <legend className="text-xs text-muted-foreground px-1">
          Your default serving (for this dog)
        </legend>

        <div className="grid grid-cols-1 sm:grid-cols-[1.1fr_0.9fr_1fr] gap-2 items-end">
          <div>
            <label className="block text-xs text-muted-foreground">Default serving</label>
            <div className="mt-1 flex items-center gap-2">
              <input
                name="default_qty"
                type="text"
                inputMode="decimal"
                value={defaultQty}
                onChange={(e) => setDefaultQty(e.currentTarget.value)}
                className="w-full border rounded px-2 py-1 text-sm"
                placeholder="0.5 or 3/4"
                required
              />
              <span className="text-xs text-muted-foreground whitespace-nowrap">{unitLabel}</span>
            </div>
            <p className="mt-1 text-[11px] text-subtle-foreground">Your usual serving for this dog</p>
          </div>

          <div className="hidden sm:block" />
          <div className="hidden sm:block" />
        </div>
      </fieldset>

      {/* Preview combining both groups */}
      <div className="text-xs text-muted-foreground">
        {perUnit == null ? (
          <span>Fill in serving size and calories from the package to see a preview.</span>
        ) : (
          <>
            1 {unitLabel} ≈ <span className="tabular-nums">{perUnit.toFixed(2)}</span> kcal
            {defaultKcal != null && defaultQty && (
              <>
                {' · '}Default: <span className="tabular-nums">{defaultQty}</span> {unitLabel} ≈{' '}
                <span className="tabular-nums">{defaultKcal.toFixed(0)}</span> kcal
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}

export default function CatalogAddForm({
  next,
  createAction,
}: {
  next?: string | null;
  createAction: (formData: FormData) => Promise<void>;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <form action={createAction} className="space-y-3">
        {next ? <input type="hidden" name="next" value={next} /> : null}

        <CatalogItemFields />

        <div className="flex gap-2">
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

        <RefreshOnActionComplete debounceMs={250} />
      </form>
    </div>
  );
}

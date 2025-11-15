// components/WeightAddForm.tsx
'use client';

import { useMemo, useState } from 'react';
import RefreshOnActionComplete from '@/components/RefreshOnActionComplete';

export default function WeightAddForm({
  defaultDate,
  next,
  createAction,
}: {
  defaultDate: string;
  next?: string | null;
  createAction: (formData: FormData) => Promise<void>;
}) {
  const [method, setMethod] = useState<'vet' | 'home_diff'>('vet');
  const [unit, setUnit] = useState<'kg' | 'lb'>('kg');
  const [you, setYou] = useState('');
  const [youDog, setYouDog] = useState('');
  const [weight, setWeight] = useState('');

  function numOrNull(s: string) {
    const n = parseFloat(s);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  const previewKg = useMemo(() => {
    if (method === 'vet') {
      const w = numOrNull(weight);
      if (!w) return null;
      return unit === 'lb' ? w * 0.45359237 : w;
    } else {
      const a = numOrNull(youDog);
      const b = numOrNull(you);
      if (!a || !b || a <= b) return null;
      const diff = a - b;
      return unit === 'lb' ? diff * 0.45359237 : diff;
    }
  }, [method, unit, weight, you, youDog]);

  return (
    <div className="rounded-lg border bg-card p-4">
      <form
        action={createAction}
        className="grid grid-cols-[1fr_1fr_1fr_1fr] md:grid-cols-[1fr_1fr_1fr_1fr_1fr] gap-2 items-end"
      >
        {next ? <input type="hidden" name="next" value={next} /> : null}

        <div className="col-span-2">
          <label className="text-xs text-muted-foreground">Date</label>
          <input
            name="date"
            type="date"
            defaultValue={defaultDate}
            className="w-full border rounded px-2 py-1 text-sm"
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground">Method</label>
          <select
            name="method"
            value={method}
            onChange={(e) => setMethod(e.currentTarget.value as 'vet' | 'home_diff')}
            className="w-full border rounded px-2 py-1 text-sm"
          >
            <option value="vet">Vet scale</option>
            <option value="home_diff">At home (difference)</option>
          </select>
        </div>

        <div>
          <label className="text-xs text-muted-foreground">Units</label>
          <select
            name="unit"
            value={unit}
            onChange={(e) => setUnit(e.currentTarget.value as 'kg' | 'lb')}
            className="w-full border rounded px-2 py-1 text-sm"
          >
            <option value="kg">kg</option>
            <option value="lb">lb</option>
          </select>
        </div>

        {/* Method-specific inputs */}
        {method === 'vet' ? (
          <div className="col-span-2">
            <label className="text-xs text-muted-foreground">Dog weight</label>
            <input
              name="weight"
              type="number"
              step="any"
              min="0"
              inputMode="decimal"
              value={weight}
              onChange={(e) => setWeight(e.currentTarget.value)}
              className="w-full border rounded px-2 py-1 text-sm"
              placeholder={unit === 'kg' ? '12.3' : '27.1'}
            />
          </div>
        ) : (
          <>
            <div>
              <label className="text-xs text-muted-foreground">You</label>
              <input
                name="me"
                type="number"
                step="any"
                min="0"
                inputMode="decimal"
                value={you}
                onChange={(e) => setYou(e.currentTarget.value)}
                className="w-full border rounded px-2 py-1 text-sm"
                placeholder={unit === 'kg' ? '78.2' : '172.5'}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">You + dog</label>
              <input
                name="me_plus_dog"
                type="number"
                step="any"
                min="0"
                inputMode="decimal"
                value={youDog}
                onChange={(e) => setYouDog(e.currentTarget.value)}
                className="w-full border rounded px-2 py-1 text-sm"
                placeholder={unit === 'kg' ? '90.6' : '199.9'}
              />
            </div>
          </>
        )}

        <div className="col-span-full">
          <label className="text-xs text-muted-foreground">Note (optional)</label>
          <input
            name="note"
            className="w-full border rounded px-2 py-1 text-sm"
            placeholder="e.g., after dinner, different scale"
          />
        </div>

        <div className="col-span-full flex gap-2 items-center">
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
              title="Save and return to the selected day"
            >
              Save &amp; return
            </button>
          )}
          {previewKg != null && (
            <span className="text-xs text-muted-foreground">
              Preview:&nbsp;<span className="font-medium tabular-nums">{previewKg.toFixed(2)} kg</span>
            </span>
          )}
        </div>

        <RefreshOnActionComplete debounceMs={250} />
      </form>
    </div>
  );
}

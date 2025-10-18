// app/page.tsx
import WhereServer from '@/components/WhereServer';
import WhereClient from '@/components/WhereClient';
import { todayYMDVancouver } from '@/lib/dates';
import { createClient } from '@/lib/supabase/server';
import {
  createTodayAction, addEntryAction,
  toggleEntryStatusAction, deleteEntryAction,
  moveEntryUpAction, moveEntryDownAction,
  addEntryFromCatalogAction, updateEntryQtyAction 
} from './actions';
import DeleteEntryButton from '@/components/DeleteEntryButton';

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const today = todayYMDVancouver();

  // Fetch today's day + entries (read-only; GET has no side effects)
  const { data: day } = await supabase
    .from('days')
    .select('id, date')
    .eq('date', today)
    .maybeSingle();

  let entries: Array<{
    id: string; name: string; qty: string; unit: string;
    kcal_snapshot: number; status: 'planned' | 'eaten';
    created_at: string;
  }> = [];

  if (day) {
    const { data } = await supabase
      .from('entries')
      .select('id, name, qty, unit, kcal_snapshot, status, created_at')
      .eq('day_id', day.id)
      .order('ordering', { ascending: true });   // show oldest→newest (bottom appends)
    entries = data ?? [];
  }

  // Fetch a small set for chips (favorites first, then newest)
  const { data: chipItems } = await supabase
    .from('catalog_items')
    .select('id,name,unit,kcal_per_unit,default_qty,is_favorite,created_at')
    .order('is_favorite', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(6);

  // Compute simple totals: for now, treat kcal_snapshot as kcal for the entered qty
  const totalEaten = entries
    .filter(e => e.status === 'eaten')
    .reduce((sum, e) => sum + (e.kcal_snapshot ?? 0), 0);
  const totalPlanned = entries
    .filter(e => e.status === 'planned')
    .reduce((sum, e) => sum + (e.kcal_snapshot ?? 0), 0);

  return (
    <main className="mx-auto max-w-2xl p-6 space-y-6 font-sans bg-slate-50">
      <h1 className="text-2xl font-bold">Today ({today})</h1>

      <section className="space-y-2">
        <h2 className="font-semibold">Catalog</h2>
        <div className="rounded-lg border bg-white p-4 space-y-3">
          {/* Favorite/Recent chips — whole chip is a submit button (one click to add) */}
          <div className="flex flex-wrap gap-2">
            {(chipItems ?? []).map((it) => (
              <form key={it.id} action={addEntryFromCatalogAction}>
                {/* Default multiplier = 1 */}
                <input type="hidden" name="mult" value="1" />
                {/* Use the button's name/value as form data to avoid extra hidden input */}
                <button
                  type="submit"
                  name="catalog_item_id"
                  value={it.id}
                  className="border rounded px-2 py-1 text-left text-xs bg-slate-50 hover:bg-gray-50 active:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-slate-300"
                  aria-label={`Add ${it.name}`}
                >
                  <div className="font-medium">{it.name}</div>
                  <div className="text-[11px] text-gray-600">
                    {it.default_qty} {it.unit} • {Number(it.kcal_per_unit).toFixed(2)} kcal/{it.unit}
                  </div>
                </button>
              </form>
            ))}
            {(chipItems ?? []).length === 0 && (
              <div className="text-sm text-gray-600">No catalog items yet.</div>
            )}
          </div>
        </div>
        <div className="text-sm text-gray-600">
          <a href="/catalog" className="underline">Manage catalog →</a>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Day</h2>
        <div className="rounded-lg border bg-white p-4">
          {day ? (
            <div>Day exists for {today}.</div>
          ) : (
            <form action={createTodayAction}>
              <button
                className="rounded-md border px-3 py-1 text-sm hover:bg-gray-50"
                type="submit"
              >
                Create today
              </button>
            </form>
          )}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Entries</h2>
        <div className="rounded-lg border bg-white p-4 space-y-3">
          {!day && <div className="text-sm text-gray-600">Create today first.</div>}

          {day && (
            <form action={addEntryAction} className="flex flex-wrap gap-2 items-end">
              <div className="flex flex-col">
                <label className="text-xs text-gray-600">Name</label>
                <input name="name" className="border rounded px-2 py-1 text-sm" placeholder="Chicken" />
              </div>
              <div className="flex flex-col">
                <label className="text-xs text-gray-600">Qty</label>
                <input name="qty" type="number" step="0.01" className="border rounded px-2 py-1 text-sm" placeholder="100" />
              </div>
              <div className="flex flex-col">
                <label className="text-xs text-gray-600">Unit</label>
                <input name="unit" className="border rounded px-2 py-1 text-sm" placeholder="g" />
              </div>
              <div className="flex flex-col">
                <label className="text-xs text-gray-600">kcal</label>
                <input name="kcal_snapshot" type="number" step="0.01" className="border rounded px-2 py-1 text-sm" placeholder="165" />
              </div>
              <div className="flex flex-col">
                <label className="text-xs text-gray-600">Status</label>
                <select name="status" className="border rounded px-2 py-1 text-sm">
                  <option value="planned">planned</option>
                  <option value="eaten">eaten</option>
                </select>
              </div>
              <button className="rounded-md border px-3 py-1 text-sm hover:bg-gray-50" type="submit">
                Add entry
              </button>
            </form>
          )}

          {entries.length > 0 && (
            <div className="flex items-center justify-between rounded-md bg-slate-50 p-2 text-sm">
              <div><span className="font-medium">Planned:</span> {totalPlanned} kcal</div>
              <div><span className="font-medium">Eaten:</span> {totalEaten} kcal</div>
              <div><span className="font-medium">Total:</span> {totalPlanned + totalEaten} kcal</div>
            </div>
          )}

          <ul className="divide-y">
            {entries.map(e => (
              <li key={e.id} className="py-2 flex items-start justify-between">
                <div className="flex-1">
                  <div className="font-medium">{e.name}</div>

                  {/* Inline qty editor + status toggle merged into the description */}
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-600">
                    {/* Qty edit */}
                    <form action={updateEntryQtyAction} className="flex items-center gap-1">
                      <input type="hidden" name="entry_id" value={e.id} />
                      <label htmlFor={`qty-${e.id}`} className="sr-only">Quantity</label>
                      <input
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
                    </form>

                    <span aria-hidden="true">•</span>

                    {/* Status segmented control: selected segment = current state; other segment = action */}
                    <div className="inline-flex overflow-hidden rounded border">
                      {e.status === 'planned' ? (
                        <>
                          <span className="px-2 py-0.5 bg-slate-200 text-slate-900 font-medium select-none">
                            Planned
                          </span>
                          <form action={toggleEntryStatusAction}>
                            <input type="hidden" name="entry_id" value={e.id} />
                            <input type="hidden" name="next_status" value="eaten" />
                            <button
                              type="submit"
                              className="px-2 py-0.5 hover:bg-gray-50"
                              title="Mark as eaten"
                            >
                              Eaten
                            </button>
                          </form>
                        </>
                      ) : (
                        <>
                          <form action={toggleEntryStatusAction}>
                            <input type="hidden" name="entry_id" value={e.id} />
                            <input type="hidden" name="next_status" value="planned" />
                            <button
                              type="submit"
                              className="px-2 py-0.5 hover:bg-gray-50"
                              title="Mark as planned"
                            >
                              Planned
                            </button>
                          </form>
                          <span className="px-2 py-0.5 bg-slate-200 text-slate-900 font-medium select-none">
                            Eaten
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-sm">{Number(e.kcal_snapshot).toFixed(2)} kcal</div>

                  {/* Move up / Move down */}
                  <form action={moveEntryUpAction}>
                    <input type="hidden" name="entry_id" value={e.id} />
                    <button type="submit" className="rounded border px-2 py-1 text-xs hover:bg-gray-50" title="Move up">
                      ↑
                    </button>
                  </form>
                  <form action={moveEntryDownAction}>
                    <input type="hidden" name="entry_id" value={e.id} />
                    <button type="submit" className="rounded border px-2 py-1 text-xs hover:bg-gray-50" title="Move down">
                      ↓
                    </button>
                  </form>

                  {/* Delete */}
                  <DeleteEntryButton entryId={e.id} />
                </div>
              </li>
            ))}
            {day && entries.length === 0 && (
              <li className="py-2 text-sm text-gray-600">No entries yet.</li>
            )}
          </ul>
        </div>
      </section>

      <WhereServer />
      <WhereClient />
    </main>
  );
}

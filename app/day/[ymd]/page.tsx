// app/day/[ymd]/page.tsx
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import {
  todayInTZYMD,
  isValidYMD,
  addDaysYMD,
  formatYMDLong, // timezone-invariant long label for a YYYY-MM-DD
} from '@/lib/dates';
import {
  addEntryAction,
  toggleEntryStatusAction,
  moveEntryUpAction,
  moveEntryDownAction,
  addEntryFromCatalogAction,
  updateEntryQtyAction,
} from '@/app/actions';
import DeleteEntryButton from '@/components/DeleteEntryButton';

export default async function DayPage({ params }: { params: Promise<{ ymd: string }> }) {
  const { ymd } = await params;

  const supabase = await createClient();

  // Resolve the literal date from the path. If invalid, default using tz cookie (or Vancouver).
  const cookieStore = await cookies();
  const tz = cookieStore.get('tz')?.value ?? 'America/Vancouver';
  const selectedYMD = isValidYMD(ymd) ? ymd : todayInTZYMD(tz);
  if (!isValidYMD(ymd)) {
    redirect(`/day/${selectedYMD}`);
  }

  const friendly = formatYMDLong(selectedYMD);

  // Auth gate: anonymous → /login?next=/day/<ymd>
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/day/${selectedYMD}`)}`);
  }

  // Nav dates (pure date math on literal YYYY-MM-DD)
  const prevYMD = addDaysYMD(selectedYMD, -1);
  const nextYMD = addDaysYMD(selectedYMD, +1);
  const todayYMD = todayInTZYMD(tz);

  // Fetch this day's "day" + entries (read-only; GET has no side effects)
  const { data: day } = await supabase
    .from('days')
    .select('id, date')
    .eq('date', selectedYMD)
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
    // Coerce Supabase numeric -> JS number once to avoid string math bugs
    entries = (data ?? []).map(e => ({
      ...e,
      kcal_snapshot: Number(e.kcal_snapshot ?? 0),
    }));
  }

  // Fetch a small set for chips (favorites first, then newest)
  const { data: chipItems } = await supabase
    .from('catalog_items')
    .select('id,name,unit,kcal_per_unit,default_qty,is_favorite,created_at')
    .order('is_favorite', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(6);

  // Totals for the visible day
  const totalEaten = entries
    .filter(e => e.status === 'eaten')
    .reduce((sum, e) => sum + e.kcal_snapshot, 0);
  const totalPlanned = entries
    .filter(e => e.status === 'planned')
    .reduce((sum, e) => sum + e.kcal_snapshot, 0);

  return (
    <main className="mx-auto max-w-2xl p-6 space-y-6 font-sans bg-slate-50">
      {/* Header + date nav */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{friendly}</h1>
        <nav className="flex items-center gap-2 text-sm">
          <Link href={`/day/${prevYMD}`} className="rounded border px-2 py-1 hover:bg-gray-50" title="Previous day">← Prev</Link>
          <Link href={`/day/${todayYMD}`} className="rounded border px-2 py-1 hover:bg-gray-50" title="Jump to today">Today</Link>
          <Link href={`/day/${nextYMD}`} className="rounded border px-2 py-1 hover:bg-gray-50" title="Next day">Next →</Link>
        </nav>
      </div>

      {/* Unified "Add to today" section with labeled subsections */}
      <section className="space-y-2">
        <h2 className="font-semibold">Add to today</h2>
        <div className="rounded-lg border bg-white p-4 space-y-4">
          {/* Catalog subsection */}
          <div>
            <div className="mb-2 text-xs font-semibold text-gray-700 uppercase tracking-wide">
              Catalog
            </div>
            <div className="flex flex-wrap gap-2">
              {(chipItems ?? []).map((it) => (
                <form key={it.id} action={addEntryFromCatalogAction}>
                  <input type="hidden" name="date" value={selectedYMD} />
                  {/* Default multiplier = 1 */}
                  <input type="hidden" name="mult" value="1" />
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
            <div className="mt-2 text-sm text-gray-600">
              <Link href="/catalog" className="underline">Manage catalog →</Link>
            </div>
          </div>

          <div className="border-t my-2" />

          {/* One-time subsection (manual add) */}
          <div>
            <div className="mb-2 text-xs font-semibold text-gray-700 uppercase tracking-wide">
              One-time
            </div>
            <form action={addEntryAction} className="flex flex-wrap gap-2 items-end">
              <input type="hidden" name="date" value={selectedYMD} />
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
          </div>
        </div>
      </section>

      {/* Entries with totals at the bottom */}
      <section className="space-y-2">
        <h2 className="font-semibold">Entries</h2>
        <div className="rounded-lg border bg-white p-4 space-y-3">
          <ul className="divide-y">
            {entries.map(e => (
                <li
                  key={e.id}
                  className={`py-2 flex items-start justify-between rounded-md ${
                    e.status === 'planned'
                      ? 'bg-amber-50 border-l-4 border-amber-400'
                      : ''
                  }`}
                >
                <div className="flex-1">
                  <div className="font-medium">{e.name}</div>

                  {/* Inline qty editor + status toggle merged into the description */}
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-600">
                    {/* Qty edit */}
                    <form action={updateEntryQtyAction} className="flex items-center gap-1">
                      <input type="hidden" name="date" value={selectedYMD} />
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
                            <input type="hidden" name="date" value={selectedYMD} />
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
                            <input type="hidden" name="date" value={selectedYMD} />
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
                    <input type="hidden" name="date" value={selectedYMD} />
                    <input type="hidden" name="entry_id" value={e.id} />
                    <button type="submit" className="rounded border px-2 py-1 text-xs hover:bg-gray-50" title="Move up">
                      ↑
                    </button>
                  </form>
                  <form action={moveEntryDownAction}>
                    <input type="hidden" name="date" value={selectedYMD} />
                    <input type="hidden" name="entry_id" value={e.id} />
                    <button type="submit" className="rounded border px-2 py-1 text-xs hover:bg-gray-50" title="Move down">
                      ↓
                    </button>
                  </form>

                  {/* Delete */}
                  <DeleteEntryButton entryId={e.id} date={selectedYMD} />
                </div>
              </li>
            ))}
            {entries.length === 0 && (
              <li className="py-2 text-sm text-gray-600">No entries yet.</li>
            )}
          </ul>

          {/* Totals at the bottom */}
          {entries.length > 0 && (
            <div className="pt-3 mt-2 border-t text-sm flex items-center justify-between">
              <div><span className="font-medium">Planned:</span> {totalPlanned.toFixed(2)} kcal</div>
              <div><span className="font-medium">Eaten:</span> {totalEaten.toFixed(2)} kcal</div>
              <div><span className="font-medium">Total:</span> {(totalPlanned + totalEaten).toFixed(2)} kcal</div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

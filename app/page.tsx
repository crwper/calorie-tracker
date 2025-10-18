// app/page.tsx
import WhereServer from '@/components/WhereServer';
import WhereClient from '@/components/WhereClient';
import { todayYMDVancouver } from '@/lib/dates';
import { createClient } from '@/lib/supabase/server';
import { createTodayAction, addEntryAction, toggleEntryStatusAction } from './actions';

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
      .order('created_at', { ascending: false });
    entries = data ?? [];
  }

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
                <input name="kcal_snapshot" type="number" step="1" className="border rounded px-2 py-1 text-sm" placeholder="165" />
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
              <li key={e.id} className="py-2 flex items-center justify-between">
                <div>
                  <div className="font-medium">{e.name}</div>
                  <div className="text-xs text-gray-600">{e.qty} {e.unit} • {e.status}</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-sm">{e.kcal_snapshot} kcal</div>
                  <form action={toggleEntryStatusAction}>
                    <input type="hidden" name="entry_id" value={e.id} />
                    <input
                      type="hidden"
                      name="next_status"
                      value={e.status === 'eaten' ? 'planned' : 'eaten'}
                    />
                    <button
                      type="submit"
                      className="rounded border px-2 py-1 text-xs hover:bg-gray-50"
                      title={e.status === 'eaten' ? 'Mark as planned' : 'Mark as eaten'}
                    >
                      {e.status === 'eaten' ? '⇤ Planned' : '✓ Eaten'}
                    </button>
                  </form>
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

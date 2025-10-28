// app/goals/page.tsx
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { todayInTZYMD, addDaysYMD, formatYMDLong } from '@/lib/dates';
import { createGoalAction } from './actions';
import DeleteGoalButton from '@/components/DeleteGoalButton';

export const dynamic = 'force-dynamic';

export default async function GoalsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const rawNext = typeof sp.next === 'string' ? sp.next : null;
  const next = rawNext && rawNext.startsWith('/') ? rawNext : null;

  const supabase = await createClient();

  // Auth gate
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/goals');

  // Load goals, newest start_date first
  const { data: goals } = await supabase
    .from('goals')
    .select('id,start_date,kcal_target,note,created_at')
    .order('start_date', { ascending: false })
    .order('created_at', { ascending: false });

  // Default date = today in cookie TZ
  const ck = await cookies();
  const tz = ck.get('tz')?.value ?? 'America/Vancouver';
  const today = todayInTZYMD(tz);

  // Compute effective end_date for display:
  // for a row at index i (desc order), end = (previous row's start_date) - 1 day
  const rows = (goals ?? []).map((g, i, arr) => {
    const prev = i === 0 ? null : arr[i - 1];
    const end = prev ? addDaysYMD(String(prev.start_date), -1) : null;
    return { ...g, end_date: end };
  });

  return (
    <main className="mx-auto max-w-2xl p-6 space-y-6 font-sans bg-slate-50">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Goals</h1>
        {next && (
          <Link href={next} className="rounded border px-2 py-1 text-sm hover:bg-gray-50">
            ‹ Back to day
          </Link>
        )}
      </div>

      {/* Add goal */}
      <section className="space-y-2">
        <h2 className="font-semibold">Add goal</h2>
        <div className="rounded-lg border bg-white p-4">
          <form action={createGoalAction} className="grid grid-cols-[2fr_1fr] md:grid-cols-[1fr_1fr_1fr_1fr] gap-2 items-end">
            {next ? <input type="hidden" name="next" value={next} /> : null}

            <div>
              <label className="text-xs text-gray-600">Start date</label>
              <input
                name="start_date"
                type="date"
                defaultValue={today}
                className="w-full border rounded px-2 py-1 text-sm"
              />
            </div>

            <div>
              <label className="text-xs text-gray-600">Target (kcal/day)</label>
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
              <label className="text-xs text-gray-600">Note (optional)</label>
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
          </form>
        </div>
      </section>

      {/* List goals */}
      <section className="space-y-2">
        <h2 className="font-semibold">Your goals</h2>
        <div className="rounded-lg border bg-white p-4">
          {(rows ?? []).length === 0 ? (
            <ul className="divide-y"><li className="py-2 text-sm text-gray-600">No goals yet. Add one above.</li></ul>
          ) : (
            <ul className="divide-y">
              {rows.map((g, idx) => {
                const startLabel = formatYMDLong(String(g.start_date));
                const endLabel = g.end_date ? formatYMDLong(String(g.end_date)) : 'Present';
                const current = idx === 0 && !g.end_date;

                return (
                  <li key={g.id} className="py-2">
                    <div className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-1">
                      <div>
                        <div className="font-medium">
                          {startLabel} → {endLabel}
                          {current ? <span className="ml-2 text-xs rounded border px-1 py-0.5 bg-slate-50">Current</span> : null}
                        </div>
                        <div className="text-xs text-gray-600 mt-0.5">
                          Target: <span className="font-medium tabular-nums">{g.kcal_target}</span> kcal/day
                          {g.note ? <> · <span className="italic">{g.note}</span></> : null}
                        </div>
                      </div>
                      <div className="flex items-center">
                        <DeleteGoalButton id={g.id} />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}

// app/weights/page.tsx
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { todayInTZYMD, formatYMDLong } from '@/lib/dates';
import WeightAddForm from '@/components/WeightAddForm';
import DeleteButton from '@/components/primitives/DeleteButton';
import { deleteWeightAction } from '@/app/weights/actions';
import { createWeightAction } from './actions';

export const dynamic = 'force-dynamic';

export default async function WeightsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const rawNext = typeof sp.next === 'string' ? sp.next : null;
  const next = rawNext && rawNext.startsWith('/') ? rawNext : null;

  const supabase = await createClient();

  // Auth gate: anonymous → /login?next=/weights
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/weights');

  // Fetch weights for the user (newest first)
  const { data: weights } = await supabase
    .from('weights')
    .select('id, measured_at, method, weight_kg, me_kg, me_and_dog_kg, note, created_at')
    .order('measured_at', { ascending: false })
    .order('created_at', { ascending: false });

  // Default date comes from cookie TZ (same pattern as elsewhere)
  const ck = await cookies();
  const tz = ck.get('tz')?.value ?? 'America/Vancouver';
  const today = todayInTZYMD(tz);

  return (
    <main className="mx-auto max-w-2xl p-6 space-y-6 font-sans bg-slate-50">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Weights</h1>
        {next && (
          <Link href={next} className="rounded border px-2 py-1 text-sm hover:bg-gray-50">
            ‹ Back to day
          </Link>
        )}
      </div>

      {/* Add weight */}
      <section className="space-y-2">
        <h2 className="font-semibold">Add weight</h2>
        <WeightAddForm defaultDate={today} next={next} createAction={createWeightAction} />
      </section>

      {/* History */}
      <section className="space-y-2">
        <h2 className="font-semibold">Your measurements</h2>
        <div className="rounded-lg border bg-white p-4">
          {!weights || weights.length === 0 ? (
            <ul className="divide-y">
              <li className="py-2 text-sm text-gray-600">No weights yet. Add one above.</li>
            </ul>
          ) : (
            <ul className="divide-y">
              {weights.map((w) => (
                <li key={w.id} className="py-2">
                  <div className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-1">
                    <div>
                      <div className="font-medium">{formatYMDLong(String(w.measured_at))}</div>
                      <div className="text-xs text-gray-600 mt-0.5">
                        {w.note ? <>{w.note}</> : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="text-sm font-medium tabular-nums">{Number(w.weight_kg).toFixed(2)} kg</div>
                      <DeleteButton
                        formAction={deleteWeightAction}
                        hidden={{ id: w.id }}
                        title="Delete weight entry"
                        aria-label="Delete weight entry"
                        confirmMessage="Delete this weight entry?"
                        withRefresh={250}
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}

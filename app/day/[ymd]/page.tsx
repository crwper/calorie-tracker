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
import { addEntryFromCatalogAction } from '@/app/actions';
import EntriesList from '@/components/EntriesList';
import CatalogChipPicker from '@/components/CatalogChipPicker';
import RefreshNowButton from '@/components/dev/RefreshNowButton';
import RealtimeBridge from '@/components/realtime/RealtimeBridge';
import PendingOpsDebug from '@/components/realtime/PendingOpsDebug';

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
  
  const serverRenderAt = new Date().toISOString();

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
    id: string;
    name: string;
    qty: string;
    unit: string;
    kcal_snapshot: number;
    status: 'planned' | 'eaten';
    created_at: string;
    kcal_per_unit_snapshot: number | null;
  }> = [];

  if (day) {
    const { data } = await supabase
      .from('entries')
      .select('id, name, qty, unit, kcal_snapshot, kcal_per_unit_snapshot, status, created_at')
      .eq('day_id', day.id)
      .order('ordering', { ascending: true });

    entries = (data ?? []).map(e => ({
      ...e,
      kcal_snapshot: Number(e.kcal_snapshot ?? 0),
      kcal_per_unit_snapshot:
        e.kcal_per_unit_snapshot != null ? Number(e.kcal_per_unit_snapshot) : null,
    }));
  }

  // Ordered by: last used date desc, then first appearance that day asc,
  // then name asc for never-used items.
  const { data: orderedItems } = await supabase.rpc('get_catalog_items_usage_order');
  const chipItems = orderedItems ?? []; // let the picker limit what it shows

  // Totals for the visible day (derived from the current server fetch)
  const totalEaten = entries
    .filter(e => e.status === 'eaten')
    .reduce((sum, e) => sum + e.kcal_snapshot, 0);
  const totalPlanned = entries
    .filter(e => e.status === 'planned')
    .reduce((sum, e) => sum + e.kcal_snapshot, 0);

  // Active goal for this day (latest start_date <= selectedYMD)
  const { data: goalRows } = await supabase
    .from('goals')
    .select('start_date,kcal_target')
    .lte('start_date', selectedYMD)
    .order('start_date', { ascending: false })
    .limit(1);
  const activeGoal = (goalRows ?? [])[0] ?? null;

  return (
    <main className="mx-auto max-w-2xl p-6 space-y-6 font-sans bg-canvas">
      {/* Header + date nav */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{friendly}</h1>
        <nav className="flex items-center gap-2 text-sm">
          <Link href={`/day/${prevYMD}`} className="rounded border px-2 py-1 hover:bg-control-hover" title="Previous day">← Prev</Link>
          <Link href={`/day/${todayYMD}`} className="rounded border px-2 py-1 hover:bg-control-hover" title="Jump to today">Today</Link>
          <Link href={`/day/${nextYMD}`} className="rounded border px-2 py-1 hover:bg-control-hover" title="Next day">Next →</Link>
          {process.env.NODE_ENV !== 'production' ? (
            <RefreshNowButton label="Refresh" />
          ) : null}
        </nav>
      </div>

      {/* Unified "Add to today" section with labeled subsections */}
      <section className="space-y-2">
        <h2 className="font-semibold">Add to today</h2>
        <div className="rounded-lg border bg-card p-4 space-y-4">
          {/* catalogpage subsection */}
          <div>
            <CatalogChipPicker
              items={chipItems ?? []}
              selectedYMD={selectedYMD}
              addFromCatalogAction={addEntryFromCatalogAction}
              visibleLimit={20}
            />
            <div className="mt-2 text-sm text-muted-foreground">
              <Link
                href={{
                  pathname: '/catalog',
                  query: { next: `/day/${selectedYMD}` },
                }}
                className="underline">Manage catalog →</Link>
            </div>
          </div>
        </div>
      </section>

      {/* Entries with totals at the bottom */}
      <section className="space-y-2">
        <h2 className="font-semibold">Entries</h2>
        <div className="rounded-lg border bg-card p-4 space-y-3">
          {/* Drag-and-drop list with optimistic updates */}
          <EntriesList entries={entries} selectedYMD={selectedYMD} />

          {/* NEW wrapper: only controls spacing between these two lines */}
          <div className="space-y-1">
            {entries.length > 0 && (
              <div className="pt-3 mt-2 border-t text-sm flex items-center justify-between">
                <div><span className="font-medium">Planned:</span> {totalPlanned.toFixed(2)} kcal</div>
                <div><span className="font-medium">Eaten:</span> {totalEaten.toFixed(2)} kcal</div>
                <div><span className="font-medium">Total:</span> {(totalPlanned + totalEaten).toFixed(2)} kcal</div>
              </div>
            )}

            {activeGoal && entries.length > 0 && (
              <div className="text-sm flex items-center justify-end leading-tight">
                Goal:&nbsp;<span className="font-medium tabular-nums">{activeGoal.kcal_target}</span>&nbsp;kcal
              </div>
            )}
          </div>
        </div>
      </section>

      <p className="text-xs text-subtle-foreground">Rendered at {serverRenderAt}</p>

      {/* Realtime: scoped to this day */}
      {day && (
        <RealtimeBridge
          channel={`rt-entries-day-${day.id}`}
          table="entries"
          // Scope strictly to this day; RLS keeps it user-scoped
          filter={`day_id=eq.${day.id}`}
          debounceMs={250}
          ignoreLocalWritesTTL={400}
          devLabel="Day entries"
        />
      )}

      {/* Bootstrap case: day row doesn't exist yet; listen for it by date */}
      {!day && (
        <RealtimeBridge
          channel={`rt-days-bootstrap-${selectedYMD}`}
          table="days"
          // Only care about this literal date; RLS keeps it user-scoped
          filter={`date=eq.${selectedYMD}`}
          debounceMs={250}
          ignoreLocalWritesTTL={400}
          devLabel="Day bootstrap"
          showIndicator={false} // avoid a second status pill if you like
        />
      )}

      {/* Dev‑only pending op‑id overlay */}
      {process.env.NODE_ENV !== 'production' ? <PendingOpsDebug /> : null}
    </main>
  );
}

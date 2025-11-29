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

  // Ensure a "day" row exists for this date and get its id (creates if needed).
  const { data: dayId, error: dayErr } = await supabase.rpc('get_or_create_day', {
    p_date: selectedYMD,
  });
  if (dayErr) {
    throw new Error(dayErr.message);
  }
  const dayIdStr = String(dayId);

  // Fetch this day's entries
  const { data: entriesData } = await supabase
    .from('entries')
    .select('id, name, qty, unit, kcal_snapshot, kcal_per_unit_snapshot, status, created_at')
    .eq('day_id', dayIdStr)
    .order('ordering', { ascending: true });

  const entries: Array<{
    id: string;
    name: string;
    qty: string;
    unit: string;
    kcal_snapshot: number;
    status: 'planned' | 'eaten';
    created_at: string;
    kcal_per_unit_snapshot: number | null;
  }> = (entriesData ?? []).map((e) => ({
    ...e,
    kcal_snapshot: Number(e.kcal_snapshot ?? 0),
    kcal_per_unit_snapshot:
      e.kcal_per_unit_snapshot != null ? Number(e.kcal_per_unit_snapshot) : null,
  }));

  // Ordered by: last used date desc, then first appearance that day asc,
  // then name asc for never-used items.
  const { data: orderedItems } = await supabase.rpc('get_catalog_items_usage_order');
  const chipItems = orderedItems ?? []; // let the picker limit what it shows

  // Active goal for this day (latest start_date <= selectedYMD)
  const { data: goalRows } = await supabase
    .from('goals')
    .select('start_date,kcal_target')
    .lte('start_date', selectedYMD)
    .order('start_date', { ascending: false })
    .limit(1);
  const activeGoal = (goalRows ?? [])[0] ?? null;
  const activeGoalKcal = activeGoal ? Number(activeGoal.kcal_target) : null;

  return (
    <main className="mx-auto max-w-2xl p-6 space-y-6 font-sans bg-canvas">
      {/* Header + date nav */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{friendly}</h1>
        <nav className="flex items-center gap-2 text-sm">
          <Link
            href={`/day/${prevYMD}`}
            className="rounded border px-2 py-1 hover:bg-control-hover"
            title="Previous day"
          >
            ← Prev
          </Link>
          <Link
            href={`/day/${todayYMD}`}
            className="rounded border px-2 py-1 hover:bg-control-hover"
            title="Jump to today"
          >
            Today
          </Link>
          <Link
            href={`/day/${nextYMD}`}
            className="rounded border px-2 py-1 hover:bg-control-hover"
            title="Next day"
          >
            Next →
          </Link>
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
                className="underline"
              >
                Manage catalog →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Entries with totals at the bottom (now inside EntriesList) */}
      <section className="space-y-2">
        <h2 className="font-semibold">Entries</h2>
        <div className="rounded-lg border bg-card p-4 space-y-3">
          {/* Drag-and-drop list with optimistic updates + totals */}
          <EntriesList
            entries={entries}
            selectedYMD={selectedYMD}
            activeGoalKcal={activeGoalKcal}
          />
        </div>
      </section>

      <p className="text-xs text-subtle-foreground">Rendered at {serverRenderAt}</p>

      {/* Realtime: scoped to this day */}
      <RealtimeBridge
        channel={`rt-entries-day-${dayIdStr}`}
        table="entries"
        // Scope strictly to this day; RLS keeps it user-scoped
        filter={`day_id=eq.${dayIdStr}`}
        debounceMs={250}
        ignoreLocalWritesTTL={400}
        devLabel="Day entries"
      />

      {/* Dev‑only pending op‑id overlay */}
      {process.env.NODE_ENV !== 'production' ? <PendingOpsDebug /> : null}
    </main>
  );
}

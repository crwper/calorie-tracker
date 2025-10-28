// app/charts/page.tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ChartsClient from '@/components/ChartsClient';

export const dynamic = 'force-dynamic';

function toUTCms(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

type WeightRow = { measured_at: string; weight_kg: number };
type GoalRow = { start_date: string; kcal_target: number };
type DailyRow = { date: string; planned_kcal: number; eaten_kcal: number; total_kcal: number };

export default async function ChartsPage() {
  const supabase = await createClient();

  // Auth gate
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/charts');

  // Load data
  const [{ data: weights }, { data: goals }, { data: daily }] = await Promise.all([
    supabase.from('weights')
      .select('measured_at,weight_kg')
      .order('measured_at', { ascending: true }) as Promise<{ data: WeightRow[] | null }>,
    supabase.from('goals')
      .select('start_date,kcal_target')
      .order('start_date', { ascending: true }) as Promise<{ data: GoalRow[] | null }>,
    supabase.rpc('get_daily_kcal_totals') as Promise<{ data: DailyRow[] | null }>,
  ]);

  const goalsAsc = (goals ?? []).map(g => ({
    start: g.start_date,
    target: Number(g.kcal_target),
    t: toUTCms(g.start_date),
  }));

  // Helper: active goal for a given YYYY-MM-DD (or null if none yet)
  function activeGoal(ymd: string): number | null {
    if (!goalsAsc.length) return null;
    let lo = 0, hi = goalsAsc.length - 1, ans: number | null = null;
    const t = toUTCms(ymd);
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (goalsAsc[mid].t <= t) {
        ans = goalsAsc[mid].target;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return ans;
  }

  // Weights annotated with goal at measurement time
  const weightsWithGoal = (weights ?? []).map(w => ({
    t: toUTCms(w.measured_at),
    y: Number(w.weight_kg),
    goal: activeGoal(w.measured_at) as number | null,
    ymd: w.measured_at,
  }));

  // Daily totals (we’ll plot "total" as your spec says) + goal line
  const dailyWithGoal = (daily ?? []).map(d => ({
    t: toUTCms(d.date),
    total: Number(d.total_kcal),
    goal: activeGoal(d.date) as number | null,
    ymd: d.date,
  }));

  return (
    <main className="mx-auto max-w-2xl p-6 space-y-6 font-sans bg-slate-50">
      <h1 className="text-2xl font-bold">Charts</h1>

      <ChartsClient
        weights={weightsWithGoal}
        daily={dailyWithGoal}
      />
    </main>
  );
}

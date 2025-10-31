import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ChartsClient from '@/components/ChartsClient';

export const dynamic = 'force-dynamic';

function toUTCms(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

// NOTE: numeric columns come back as string; accept string | number and cast later.
type WeightRow = { measured_at: string; weight_kg: string | number };
type GoalRow   = { start_date: string; kcal_target: number };
type DailyRow  = {
  date: string;
  planned_kcal: string | number;
  eaten_kcal: string | number;
  total_kcal: string | number;
};

export default async function ChartsPage() {
  const supabase = await createClient();

  // Auth gate
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/charts');

  // Build queries with proper result typing
  const weightsQ = supabase
    .from('weights')
    .select('measured_at,weight_kg')
    .order('measured_at', { ascending: true })
    .returns<WeightRow[]>();

  const goalsQ = supabase
    .from('goals')
    .select('start_date,kcal_target')
    .order('start_date', { ascending: true })
    .returns<GoalRow[]>();

  const dailyQ = supabase
    .rpc('get_daily_kcal_totals')
    .returns<DailyRow[]>();

  // Promise.all wants real Promises in some TS setups; .then(r => r) makes it explicit
  const [{ data: weights }, { data: goals }, { data: daily }] = await Promise.all([
    weightsQ.then(r => r),
    goalsQ.then(r => r),
    dailyQ.then(r => r),
  ]);

  const goalsAsc = (goals ?? []).map(g => ({
    start: g.start_date,
    target: Number(g.kcal_target),
    t: toUTCms(g.start_date),
  }));

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

  const weightsWithGoal = (weights ?? []).map(w => ({
    t: toUTCms(w.measured_at),
    y: Number(w.weight_kg), // handles string|number
    goal: activeGoal(w.measured_at),
    ymd: w.measured_at,
  }));

  // after you’ve loaded the data:
  const dailyArray: DailyRow[] = Array.isArray(daily) ? daily : [];

  const dailyWithGoal = dailyArray.map(d => ({
    t: toUTCms(d.date),
    total: Number(d.total_kcal),
    goal: activeGoal(d.date),
    ymd: d.date,
  }));

  return (
    <main className="mx-auto max-w-2xl p-6 space-y-6 font-sans bg-slate-50">
      <h1 className="text-2xl font-bold">Charts</h1>
      <ChartsClient weights={weightsWithGoal} daily={dailyWithGoal} />
    </main>
  );
}

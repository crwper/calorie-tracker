// components/ChartsClient.tsx
'use client';

import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
import { useMemo } from 'react';

type WeightPoint = { t: number; y: number; goal: number | null; ymd: string };
type DailyPoint = { t: number; total: number; goal: number | null; ymd: string };

const toNum = (v: unknown): number => (typeof v === 'number' ? v : Number(v));

type AxisConfig = {
  domain: [number, number];
  ticks: number[];
};

/**
 * Numeric Y‑axis helper:
 * - rounds out to nice numbers
 * - uses uniform spacing
 */
function makeNiceAxis(values: number[], opts?: { includeZero?: boolean }): AxisConfig | null {
  const nums = values.filter((v) => Number.isFinite(v));
  if (!nums.length) return null;

  let minVal = Math.min(...nums);
  let maxVal = Math.max(...nums);

  if (opts?.includeZero) {
    minVal = Math.min(0, minVal);
  }

  if (minVal === maxVal) {
    const pad = minVal === 0 ? 1 : Math.abs(minVal) * 0.1;
    minVal -= pad;
    maxVal += pad;
  }

  const span = maxVal - minVal;
  const roughStep = span / 4; // aim for ~5 ticks
  const pow10 = Math.pow(10, Math.floor(Math.log10(Math.max(roughStep, 1e-6))));
  const candidates = [1, 2, 2.5, 5, 10];
  let step = pow10;
  for (const m of candidates) {
    const s = m * pow10;
    if (s >= roughStep) {
      step = s;
      break;
    }
  }

  const niceMin = Math.floor(minVal / step) * step;
  const niceMax = Math.ceil(maxVal / step) * step;

  const ticks: number[] = [];
  for (let v = niceMin; v <= niceMax + step / 2; v += step) {
    ticks.push(Number(v.toFixed(6))); // trim FP noise
  }

  return { domain: [niceMin, niceMax], ticks };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Time X‑axis helper:
 * - picks a step in whole days (1, 7, 14, 30, 60)
 * - generates ticks at exact multiples of that step
 * - domain is [firstTick, lastTick], so grid = ticks exactly
 */
function makeTimeAxis(values: number[]): AxisConfig | null {
  const nums = values.filter((v) => Number.isFinite(v));
  if (!nums.length) return null;

  let minVal = Math.min(...nums);
  let maxVal = Math.max(...nums);

  if (minVal === maxVal) {
    // expand by ±2 days so we have some span
    minVal -= DAY_MS * 2;
    maxVal += DAY_MS * 2;
  }

  const spanDays = Math.max((maxVal - minVal) / DAY_MS, 1);

  let stepDays: number;
  if (spanDays <= 14) stepDays = 1; // daily
  else if (spanDays <= 60) stepDays = 7; // weekly
  else if (spanDays <= 180) stepDays = 14; // every 2 weeks
  else if (spanDays <= 365) stepDays = 30; // ~monthly
  else stepDays = 60; // ~every 2 months

  const stepMs = stepDays * DAY_MS;

  // First tick: multiple of step at/before minVal
  const firstTick = Math.floor(minVal / stepMs) * stepMs;

  const ticks: number[] = [];
  let t = firstTick;
  while (t <= maxVal) {
    ticks.push(t);
    t += stepMs;
  }

  // Make sure we have at least 2 ticks so the domain isn't degenerate
  if (ticks.length === 1) {
    ticks.push(ticks[0] + stepMs);
  }

  const domain: [number, number] = [ticks[0], ticks[ticks.length - 1]];
  return { domain, ticks };
}

// Minimal shape for the CartesianGrid callback so we avoid `any`
type GridXProps = {
  xAxis?: {
    scale?: (value: number) => number;
  };
};

export default function ChartsClient({
  weights,
  daily,
}: {
  weights: WeightPoint[];
  daily: DailyPoint[];
}) {
  // Stable color per goal value
  const palette = (i: number) => `hsl(${(i * 137.508) % 360} 62% 45%)`;
  const noGoalColor = 'var(--color-chart-no-goal-point)';

  const weightDatasets = useMemo(() => {
    const map = new Map<
      string,
      { label: string; color: string; points: { t: number; y: number; ymd: string }[] }
    >();

    // unique goals (null last)
    const uniqueGoals = Array.from(new Set(weights.map((w) => w.goal))).sort((a, b) => {
      if (a === null && b === null) return 0;
      if (a === null) return 1;
      if (b === null) return -1;
      return a - b;
    });
    const colorByGoal = new Map<number | 'no', string>();
    uniqueGoals.forEach((g, idx) => {
      if (g === null) colorByGoal.set('no', noGoalColor);
      else colorByGoal.set(g, palette(idx));
    });

    for (const w of weights) {
      const key = w.goal === null ? 'no' : String(w.goal);
      if (!map.has(key)) {
        const color =
          w.goal === null ? noGoalColor : colorByGoal.get(w.goal) ?? palette(map.size);
        map.set(key, {
          label: w.goal === null ? 'No goal' : `Goal: ${w.goal} kcal`,
          color,
          points: [],
        });
      }
      map.get(key)!.points.push({ t: w.t, y: w.y, ymd: w.ymd });
    }

    return Array.from(map.values());
  }, [weights]);

  const dailyData = useMemo(
    () => daily.map((d) => ({ t: d.t, total: d.total, goal: d.goal, ymd: d.ymd })),
    [daily]
  );

  // Y‑axis configs
  const weightAxis = useMemo(() => {
    if (!weights.length) return null;
    const ys = weights.map((w) => w.y);
    return makeNiceAxis(ys, { includeZero: false });
  }, [weights]);

  const dailyAxis = useMemo(() => {
    if (!daily.length) return null;
    const vals: number[] = [];
    for (const d of daily) {
      if (Number.isFinite(d.total)) vals.push(d.total);
      if (d.goal != null && Number.isFinite(d.goal)) vals.push(d.goal);
    }
    return makeNiceAxis(vals);
  }, [daily]);

  // X‑axis configs (regular time steps)
  const weightXAxis = useMemo(() => {
    if (!weights.length) return null;
    const ts = weights.map((w) => w.t);
    return makeTimeAxis(ts);
  }, [weights]);

  const dailyXAxis = useMemo(() => {
    if (!daily.length) return null;
    const ts = daily.map((d) => d.t);
    return makeTimeAxis(ts);
  }, [daily]);

  const fmtDate = (t: number) => {
    try {
      return new Date(t).toLocaleDateString(undefined, {
        timeZone: 'UTC',           // ✅ keep labels stable
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return '';
    }
  };

  return (
    <div className="space-y-6">
      {/* --- Weights chart --- */}
      <section className="rounded-lg border bg-card p-4">
        <h2 className="font-semibold mb-2">Weights (kg)</h2>
        <div style={{ width: '100%', height: 320 }}>
          <ResponsiveContainer>
            <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                verticalCoordinatesGenerator={(props: GridXProps): number[] => {
                  if (!weightXAxis || weightXAxis.ticks.length === 0) return [];
                  const scale = props.xAxis?.scale;
                  if (!scale) return [];
                  return weightXAxis.ticks.map((t) => scale(t));
                }}
              />
              <XAxis
                type="number"
                dataKey="t"
                domain={weightXAxis ? weightXAxis.domain : ['dataMin', 'dataMax']}
                ticks={weightXAxis ? weightXAxis.ticks : undefined}
                scale="time"
                tickFormatter={fmtDate}
                tick={{ fontSize: 12 }}
              />
              <YAxis
                dataKey="y"
                domain={weightAxis ? weightAxis.domain : ['dataMin', 'dataMax']}
                ticks={weightAxis ? weightAxis.ticks : undefined}
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                formatter={(val: unknown, name: string) => {
                  if (name === 'y') return [`${toNum(val).toFixed(2)} kg`, 'Weight'];
                  return [String(val), name];
                }}
                labelFormatter={(label: unknown) => fmtDate(toNum(label))}
              />
              <Legend />
              {weightDatasets.map((ds) => (
                <Scatter
                  key={ds.label}
                  name={ds.label}
                  data={ds.points}
                  fill={ds.color}
                  line={false}
                  shape="circle"
                />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* --- Daily calories chart --- */}
      <section className="rounded-lg border bg-card p-4">
        <h2 className="font-semibold mb-2">Daily calories (kcal) vs Goal</h2>
        <div style={{ width: '100%', height: 320 }}>
          <ResponsiveContainer>
            <LineChart data={dailyData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                verticalCoordinatesGenerator={(props: GridXProps): number[] => {
                  if (!dailyXAxis || dailyXAxis.ticks.length === 0) return [];
                  const scale = props.xAxis?.scale;
                  if (!scale) return [];
                  return dailyXAxis.ticks.map((t) => scale(t));
                }}
              />
              <XAxis
                type="number"
                dataKey="t"
                domain={dailyXAxis ? dailyXAxis.domain : ['dataMin', 'dataMax']}
                ticks={dailyXAxis ? dailyXAxis.ticks : undefined}
                scale="time"
                tickFormatter={fmtDate}
                tick={{ fontSize: 12 }}
              />
              <YAxis
                domain={dailyAxis ? dailyAxis.domain : ['dataMin', 'dataMax']}
                ticks={dailyAxis ? dailyAxis.ticks : undefined}
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                formatter={(val: unknown, name: string) => {
                  const n = toNum(val);
                  if (name === 'total') return [`${n.toFixed(0)} kcal`, 'Total'];
                  if (name === 'goal') return [`${n.toFixed(0)} kcal`, 'Goal'];
                  return [String(val), name];
                }}
                labelFormatter={(label: unknown) => fmtDate(toNum(label))}
              />
              <Legend />
              {/* Points only for Total */}
              <Line
                name="Total"
                type="monotone"
                dataKey="total"
                stroke="var(--foreground)"
                strokeOpacity={0}
                dot={{ r: 3, stroke: 'none', fill: 'var(--foreground)' }}
                isAnimationActive={false}
              />
              {/* Stepped goal line */}
              <Line
                name="Goal"
                type="stepAfter"
                dataKey="goal"
                stroke="var(--color-chart-goal-line)"
                strokeDasharray="6 4"
                dot={false}
                connectNulls
                strokeWidth={2}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}

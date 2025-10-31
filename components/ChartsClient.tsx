// components/ChartsClient.tsx
'use client';

import {
  ResponsiveContainer,
  ScatterChart, Scatter,
  LineChart, Line,
  CartesianGrid, XAxis, YAxis, Tooltip, Legend,
} from 'recharts';
import { useMemo } from 'react';

type WeightPoint = { t: number; y: number; goal: number | null; ymd: string };
type DailyPoint  = { t: number; total: number; goal: number | null; ymd: string };

// helpers near top of component file
const toNum = (v: unknown): number => (typeof v === 'number' ? v : Number(v));

export default function ChartsClient({
  weights,
  daily,
}: {
  weights: WeightPoint[];
  daily: DailyPoint[];
}) {
  // Stable color per goal value
  const palette = (i: number) => `hsl(${(i * 137.508) % 360} 62% 45%)`;
  const noGoalColor = '#9ca3af'; // gray-400

  const weightDatasets = useMemo(() => {
    // group weights by goal
    const map = new Map<string, { label: string; color: string; points: { t: number; y: number; ymd: string }[] }>();
    // unique, sorted goals (null last)
    const uniqueGoals = Array.from(new Set(weights.map(w => w.goal))).sort((a, b) => {
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
        const color = w.goal === null ? noGoalColor : colorByGoal.get(w.goal) ?? palette(map.size);
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

  // Daily combined dataset for LineChart
  const dailyData = useMemo(() => {
    // One array where each item contains t, total, goal (goal can be null → creates gaps if desired)
    // We'll keep goal nulls but render a stepped dashed line with connectNulls so gaps don’t break the path;
    // If you prefer breaks when no goal, set connectNulls={false}.
    return daily.map(d => ({ t: d.t, total: d.total, goal: d.goal, ymd: d.ymd }));
  }, [daily]);

  const fmtDate = (t: number) => {
    try { return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); }
    catch { return ''; }
  };

  return (
    <div className="space-y-6">
      {/* --- Weight measurements by active goal --- */}
      <section className="rounded-lg border bg-white p-4">
        <h2 className="font-semibold mb-2">Weights</h2>
        <div style={{ width: '100%', height: 320 }}>
          <ResponsiveContainer>
            <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                type="number"
                dataKey="t"
                domain={['dataMin', 'dataMax']}
                scale="time"
                tickFormatter={fmtDate}
                tick={{ fontSize: 12 }}
              />
              <YAxis
                dataKey="y"
                domain={['dataMin', 'dataMax']}
                tick={{ fontSize: 12 }}
                unit=" kg"
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

      {/* --- Daily total kcal (points) + dashed goal line --- */}
      <section className="rounded-lg border bg-white p-4">
        <h2 className="font-semibold mb-2">Daily calories (Total) vs Goal</h2>
        <div style={{ width: '100%', height: 320 }}>
          <ResponsiveContainer>
            <LineChart data={dailyData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                type="number"
                dataKey="t"
                domain={['dataMin', 'dataMax']}
                scale="time"
                tickFormatter={fmtDate}
                tick={{ fontSize: 12 }}
              />
              <YAxis
                domain={['dataMin', 'dataMax']}
                tick={{ fontSize: 12 }}
                unit=" kcal"
              />
              <Tooltip
                formatter={(val: unknown, name: string) => {
                  const n = toNum(val);
                  if (name === 'total') return [`${n.toFixed(0)} kcal`, 'Total'];
                  if (name === 'goal')  return [`${n.toFixed(0)} kcal`, 'Goal'];
                  return [String(val), name];
                }}
                labelFormatter={(label: unknown) => fmtDate(toNum(label))}
              />
              <Legend />
              {/* Points only for Total (stroke="none" shows dots only) */}
              <Line
                name="Total"
                type="monotone"
                dataKey="total"
                stroke="var(--foreground)"        // provide a color context
                strokeOpacity={0}                 // hide the connecting line
                dot={{ r: 3, stroke: 'none', fill: 'var(--foreground)' }}  // visible dots
                isAnimationActive={false}
              />
              {/* Dashed stepped goal line */}
              <Line
                name="Goal"
                type="stepAfter"
                dataKey="goal"
                stroke="#6b7280"          // gray-500
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

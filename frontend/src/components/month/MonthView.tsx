'use client';

import { useMemo, useState } from 'react';
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, ReferenceLine,
  PieChart, Pie, Cell,
} from 'recharts';
import { useApp } from '@/context/AppContext';
import { parseISO, toISO } from '@/lib/dates';
import { COLORS } from '@/lib/constants';
import { MonthRange } from '@/types';
import Card from '@/components/ui/Card';
import Select from '@/components/ui/Select';

const WEIGHT_COLOR = '#3E7B27';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface DayAgg { calories: number; protein: number; carbs: number; fat: number; fibre: number }
const emptyAgg = (): DayAgg => ({ calories: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 });

export default function MonthView() {
  const { logs, weights, targets } = useApp();
  const [range, setRange] = useState<MonthRange>('month');

  // Daily totals from all logs
  const dayMap = useMemo(() => {
    const m = new Map<string, DayAgg>();
    for (const l of logs) {
      const d = m.get(l.date) ?? emptyAgg();
      d.calories += l.calories; d.protein += l.protein; d.carbs += l.carbs;
      d.fat += l.fat; d.fibre += l.fibre;
      m.set(l.date, d);
    }
    return m;
  }, [logs]);

  const now = new Date(); now.setHours(0, 0, 0, 0);
  const todayISO = toISO(now);

  // Range start date
  const start = useMemo(() => {
    if (range === 'month') return new Date(now.getFullYear(), now.getMonth(), 1);
    if (range === '3m')    return new Date(now.getFullYear(), now.getMonth() - 2, 1);
    if (range === '6m')    return new Date(now.getFullYear(), now.getMonth() - 5, 1);
    if (range === 'year')  return new Date(now.getFullYear(), 0, 1);
    const all = [...logs.map(l => l.date), ...weights.map(w => w.date)].sort();
    return all.length ? parseISO(all[0]) : new Date(now.getFullYear(), now.getMonth(), 1);
  }, [range, logs, weights]); // eslint-disable-line react-hooks/exhaustive-deps

  const inRange = (iso: string) => iso >= toISO(start) && iso <= todayISO;

  const headerLabel =
    range === 'month' ? now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) :
    range === 'year'  ? String(now.getFullYear()) :
    range === '3m'    ? 'Last 3 months' :
    range === '6m'    ? 'Last 6 months' : 'All time';

  // ── Trend data ──────────────────────────────────────────────────────────
  // 'month' → daily; longer ranges → monthly avg
  const trend = useMemo(() => {
    if (range === 'month') {
      const days = now.getDate();
      return Array.from({ length: days }, (_, i) => {
        const iso = toISO(new Date(now.getFullYear(), now.getMonth(), i + 1));
        return { label: String(i + 1), calories: Math.round(dayMap.get(iso)?.calories ?? 0) };
      });
    }
    // monthly buckets from `start` to now
    const out: { label: string; calories: number }[] = [];
    const cur = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cur <= now) {
      let sum = 0, n = 0;
      for (const [iso, agg] of dayMap) {
        const d = parseISO(iso);
        if (d.getFullYear() === cur.getFullYear() && d.getMonth() === cur.getMonth() && agg.calories > 0) {
          sum += agg.calories; n++;
        }
      }
      const label = range === 'all'
        ? `${MONTHS[cur.getMonth()]} '${String(cur.getFullYear()).slice(2)}`
        : MONTHS[cur.getMonth()];
      out.push({ label, calories: n ? Math.round(sum / n) : 0 });
      cur.setMonth(cur.getMonth() + 1);
    }
    return out;
  }, [range, dayMap, start]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Averages over range ───────────────────────────────────────────────────
  const avg = useMemo(() => {
    const days = [...dayMap.entries()].filter(([iso, a]) => inRange(iso) && a.calories > 0).map(([, a]) => a);
    const mean = (sel: (a: DayAgg) => number) =>
      days.length ? Math.round(days.reduce((s, a) => s + sel(a), 0) / days.length) : 0;
    return {
      logged:   days.length,
      calories: mean(a => a.calories),
      protein:  mean(a => a.protein),
      carbs:    mean(a => a.carbs),
      fat:      mean(a => a.fat),
      fibre:    mean(a => a.fibre),
    };
  }, [dayMap, start]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Weight series + average ───────────────────────────────────────────────
  const weightSeries = useMemo(
    () => weights
      .filter(w => inRange(w.date))
      .map(w => ({
        label: parseISO(w.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
        weight: w.weightKg,
      })),
    [weights, start] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const avgWeight = weightSeries.length
    ? Math.round((weightSeries.reduce((s, w) => s + w.weight, 0) / weightSeries.length) * 10) / 10
    : null;

  // ── Macro split (avg grams/day, incl. fibre) ──────────────────────────────
  const macroData = [
    { name: 'Protein', value: avg.protein, color: COLORS.protein },
    { name: 'Carbs',   value: avg.carbs,   color: COLORS.carbs },
    { name: 'Fat',     value: avg.fat,     color: COLORS.fat },
    { name: 'Fibre',   value: avg.fibre,   color: COLORS.fibre },
  ];

  const tooltipStyle = { borderRadius: 12, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 12 };

  const stats: [string, number | string, string][] = [
    ['Calories', avg.calories, COLORS.cal],
    ['Protein',  `${avg.protein}g`, COLORS.protein],
    ['Carbs',    `${avg.carbs}g`,   COLORS.carbs],
    ['Fat',      `${avg.fat}g`,     COLORS.fat],
    ['Fibre',    `${avg.fibre}g`,   COLORS.fibre],
    ['Avg weight', avgWeight != null ? `${avgWeight}kg` : '—', WEIGHT_COLOR],
  ];

  return (
    <div className="space-y-4">
      {/* Header + range dropdown */}
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-ink">{headerLabel}</h2>
        <Select
          value={range}
          onChange={e => setRange(e.target.value as MonthRange)}
          className="text-sm text-ink bg-surface-2 rounded-lg pl-3 py-1.5 outline-none border border-line focus:border-primary"
        >
          <option value="month">This month</option>
          <option value="3m">Last 3 months</option>
          <option value="6m">Last 6 months</option>
          <option value="year">This year</option>
          <option value="all">Till now</option>
        </Select>
      </div>

      {/* Calorie trend */}
      <Card className="p-4">
        <div className="text-xs font-medium text-ink-muted mb-3">
          {range === 'month' ? 'Daily calories' : 'Avg daily calories / month'}
        </div>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend} margin={{ top: 6, right: 4, left: -18, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#8F9870' }} axisLine={false} tickLine={false}
                interval={range === 'month' ? 4 : 0} />
              <YAxis tick={{ fontSize: 10, fill: '#8F9870' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <ReferenceLine y={targets.cal} stroke={COLORS.cal} strokeDasharray="4 4" />
              <Area type="monotone" dataKey="calories" stroke={COLORS.cal} fill={COLORS.cal} fillOpacity={0.14} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Weight trend */}
      <Card className="p-4">
        <div className="text-xs font-medium text-ink-muted mb-3">Weight trend</div>
        <div className="h-40">
          {weightSeries.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weightSeries} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#8F9870' }} axisLine={false} tickLine={false} />
                <YAxis domain={['dataMin - 1', 'dataMax + 1']} tick={{ fontSize: 10, fill: '#8F9870' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="weight" stroke={WEIGHT_COLOR} strokeWidth={2} dot={{ r: 3, fill: WEIGHT_COLOR }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-ink-muted">
              No weight logged in this range
            </div>
          )}
        </div>
      </Card>

      {/* Macro split + averages */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <div className="text-xs font-medium text-ink-muted mb-1">Avg macro split (g)</div>
          <div className="h-32">
            {avg.logged > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={macroData} dataKey="value" innerRadius={28} outerRadius={48} paddingAngle={2}>
                    {macroData.map((m, i) => <Cell key={i} fill={m.color} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-ink-muted">No data</div>
            )}
          </div>
          <div className="flex justify-center gap-3 mt-1">
            {macroData.map(m => (
              <span key={m.name} className="flex items-center gap-1 text-xs text-ink-muted">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: m.color }} />
                {m.name}
              </span>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-xs font-medium text-ink-muted mb-3">Averages ({avg.logged} days)</div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-3">
            {stats.map(([label, value, color]) => (
              <div key={label}>
                <div className="text-lg font-bold tabular-nums leading-none" style={{ color }}>{value}</div>
                <div className="text-[11px] text-ink-muted mt-1">{label}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

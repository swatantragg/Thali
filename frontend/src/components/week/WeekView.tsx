'use client';

import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, ReferenceLine, Cell,
} from 'recharts';
import { useApp } from '@/context/AppContext';
import { sumDay } from '@/lib/nutrition';
import { toISO, addDays } from '@/lib/dates';
import { COLORS } from '@/lib/constants';
import Card from '@/components/ui/Card';
import StatCard from '@/components/ui/StatCard';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function WeekView() {
  const { logs, targets } = useApp();

  const data = useMemo(() => {
    const base = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(base, i - 6);
      return { name: DAY_NAMES[d.getDay()], ...sumDay(logs, toISO(d)) };
    });
  }, [logs]);

  const logged = data.filter(d => d.calories > 0);
  const avgCal = logged.length
    ? Math.round(logged.reduce((s, d) => s + d.calories, 0) / logged.length)
    : 0;
  const avgPro = logged.length
    ? Math.round(logged.reduce((s, d) => s + d.protein, 0) / logged.length)
    : 0;
  const onTarget = logged.filter(d => Math.abs(d.calories - targets.cal) <= targets.cal * 0.15).length;

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold text-ink">This week</h2>

      <Card className="p-4">
        <div className="text-xs font-medium text-ink-muted mb-3">Daily calories vs target</div>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 6, right: 4, left: -18, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#8F9870' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#8F9870' }} axisLine={false} tickLine={false} />
              <Tooltip
                cursor={{ fill: 'rgba(133,169,71,0.15)' }}
                contentStyle={{ borderRadius: 12, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 12 }}
              />
              <ReferenceLine y={targets.cal} stroke={COLORS.cal} strokeDasharray="4 4" />
              <Bar dataKey="calories" radius={[6, 6, 0, 0]}>
                {data.map((d, i) => (
                  <Cell
                    key={i}
                    fill={d.calories > targets.cal ? COLORS.over : COLORS.cal}
                    fillOpacity={d.calories ? 0.85 : 0.2}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Avg calories" value={avgCal} sub={`target ${targets.cal}`} />
        <StatCard label="Avg protein" value={`${avgPro}g`} sub={`target ${targets.protein}g`} color={COLORS.protein} />
        <StatCard label="On target" value={`${onTarget}/${logged.length}`} sub="days" color={COLORS.cal} />
      </div>

      <Card className="p-4">
        <div className="text-xs font-medium text-ink-muted mb-3">Macro breakdown (avg)</div>
        <div className="space-y-3">
          {logged.length > 0 ? (
            <>
              {[
                { label: 'Protein', key: 'protein' as const, color: COLORS.protein, target: targets.protein },
                { label: 'Carbs',   key: 'carbs'   as const, color: COLORS.carbs,   target: targets.carbs },
                { label: 'Fat',     key: 'fat'      as const, color: COLORS.fat,     target: targets.fat },
              ].map(({ label, key, color, target }) => {
                const avg = Math.round(logged.reduce((s, d) => s + d[key], 0) / logged.length);
                const pct = Math.min(avg / target, 1) * 100;
                return (
                  <div key={label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium text-ink-muted">{label}</span>
                      <span className="text-ink-muted tabular-nums">{avg}g / {target}g</span>
                    </div>
                    <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                    </div>
                  </div>
                );
              })}
            </>
          ) : (
            <p className="text-xs text-ink-muted">No data this week</p>
          )}
        </div>
      </Card>
    </div>
  );
}

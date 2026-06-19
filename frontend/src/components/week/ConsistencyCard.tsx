'use client';

import { useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { buildCoverage, monthGrid, currentStreak, bestStreak } from '@/lib/consistency';
import { COLORS } from '@/lib/constants';
import Card from '@/components/ui/Card';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function ConsistencyCard() {
  const { logs, fasts } = useApp();

  const { grid, leadOffset, monthLabel, done, elapsed, current, best } = useMemo(() => {
    const coverage = buildCoverage(logs, fasts);
    const now      = new Date();
    const grid     = monthGrid(coverage, now);
    const past     = grid.filter(d => !d.future);
    return {
      grid,
      leadOffset: new Date(now.getFullYear(), now.getMonth(), 1).getDay(),
      monthLabel: now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
      done:       past.filter(d => d.complete).length,
      elapsed:    past.length,
      current:    currentStreak(coverage, now),
      best:       bestStreak(coverage),
    };
  }, [logs, fasts]);

  const todayISO = new Date().toISOString().slice(0, 10);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-1">
        <div className="text-xs font-medium text-ink-muted">Consistency · {monthLabel}</div>
        <div className="text-xs text-ink-muted tabular-nums">
          {done}/{elapsed} days
        </div>
      </div>
      <p className="text-[11px] text-ink-muted mb-3">
        Green = Breakfast, Lunch &amp; Dinner all covered (Snack optional). A fasted dinner still counts.
      </p>

      {/* Streaks */}
      <div className="flex gap-8 mb-4">
        <div>
          <div className="text-2xl font-bold tabular-nums leading-none" style={{ color: COLORS.cal }}>
            {current}
          </div>
          <div className="text-[11px] text-ink-muted mt-1">Current streak {current === 1 ? 'day' : 'days'}</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-ink tabular-nums leading-none">{best}</div>
          <div className="text-[11px] text-ink-muted mt-1">Best streak {best === 1 ? 'day' : 'days'}</div>
        </div>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 gap-1.5 mb-1.5">
        {WEEKDAYS.map((w, i) => (
          <div key={i} className="text-center text-[10px] text-ink-muted">{w}</div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: leadOffset }, (_, i) => <span key={`lead-${i}`} />)}
        {grid.map(d => {
          const bg = d.future
            ? 'var(--surface-2)'
            : d.complete
              ? COLORS.cal
              : COLORS.over;
          const isToday = d.iso === todayISO;
          return (
            <div
              key={d.iso}
              title={`${d.iso} · ${d.future ? 'upcoming' : d.complete ? 'consistent' : 'incomplete'}`}
              className="aspect-square rounded-md flex items-center justify-center text-[10px] font-medium tabular-nums"
              style={{
                backgroundColor: bg,
                opacity: d.future ? 0.5 : d.complete ? 1 : 0.85,
                color: d.future ? 'var(--muted)' : '#fff',
                outline: isToday ? '2px solid var(--primary)' : 'none',
                outlineOffset: isToday ? 1 : 0,
              }}
            >
              {d.day}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 text-[11px] text-ink-muted">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLORS.cal }} /> Consistent
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLORS.over, opacity: 0.85 }} /> Missed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: 'var(--surface-2)' }} /> Upcoming
        </span>
      </div>
    </Card>
  );
}

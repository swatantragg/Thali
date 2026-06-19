'use client';

import { useMemo } from 'react';
import { Flame } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { buildCoverage, currentStreak, flameTier } from '@/lib/consistency';

// Warmer colour as the streak climbs through each 7-day tier.
const TIER_COLOR = ['', '#E0A11B', '#F97316', '#EF4444', '#DC2626'];

export default function StreakFlame({ className = '' }: { className?: string }) {
  const { logs, fasts } = useApp();

  const streak = useMemo(
    () => currentStreak(buildCoverage(logs, fasts)),
    [logs, fasts]
  );

  // streak 0 → no fire at all (per spec)
  if (streak < 1) return null;

  const tier  = flameTier(streak);          // 1‥4
  const color = TIER_COLOR[tier];

  return (
    <div
      title={`${streak}-day streak — log Breakfast, Lunch & Dinner (or fast) every day to keep it alive`}
      aria-label={`${streak} day streak`}
      className={`flex items-center gap-0.5 rounded-full bg-accent-soft pl-1.5 pr-2 py-1 ${className}`}
    >
      <span className="flex items-center -space-x-1.5">
        {Array.from({ length: tier }, (_, i) => (
          <Flame key={i} size={15} fill={color} stroke={color} strokeWidth={1.5} />
        ))}
      </span>
      <span className="text-xs font-bold tabular-nums" style={{ color }}>{streak}</span>
    </div>
  );
}

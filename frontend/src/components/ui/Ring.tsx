import { COLORS } from '@/lib/constants';

interface RingProps {
  value: number;
  max: number;
}

export default function Ring({ value, max }: RingProps) {
  const r = 72;
  const circumference = 2 * Math.PI * r;
  const pct = Math.min(value / max, 1);
  const over = value > max;
  const color = over ? COLORS.over : COLORS.cal;

  return (
    <div className="relative w-44 h-44">
      <svg viewBox="0 0 180 180" className="w-44 h-44 -rotate-90">
        <circle cx="90" cy="90" r={r} fill="none" style={{ stroke: 'var(--surface-2)' }} strokeWidth="14" />
        <circle
          cx="90"
          cy="90"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct)}
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-ink tabular-nums">{value}</span>
        <span className="text-xs text-ink-muted">of {max} kcal</span>
        <span className="mt-1 text-xs font-semibold" style={{ color }}>
          {over ? `${value - max} over` : `${max - value} left`}
        </span>
      </div>
    </div>
  );
}

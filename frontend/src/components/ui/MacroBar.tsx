interface MacroBarProps {
  label: string;
  value: number;
  target: number;
  color: string;
}

export default function MacroBar({ label, value, target, color }: MacroBarProps) {
  const pct = target ? Math.min(value / target, 1) * 100 : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-xs font-medium text-ink-muted">{label}</span>
        <span className="text-xs text-ink-muted tabular-nums">
          <span className="text-ink font-semibold">{Math.round(value)}</span>/{target}g
        </span>
      </div>
      <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

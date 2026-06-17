'use client';

import { useApp } from '@/context/AppContext';
import { sumDay } from '@/lib/nutrition';
import { addDays, toISO, formatDay } from '@/lib/dates';
import { COLORS, MEALS } from '@/lib/constants';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Ring from '@/components/ui/Ring';
import MacroBar from '@/components/ui/MacroBar';
import Card from '@/components/ui/Card';
import MealSection from './MealSection';

export default function TodayView() {
  const { logs, targets, selectedDate, setSelectedDate, addLog, updateLog, deleteLog } = useApp();
  const today = toISO(new Date());
  const t = sumDay(logs, selectedDate);
  const isToday = selectedDate === today;

  const dayItems = (meal: string) =>
    logs.filter(l => l.date === selectedDate && l.meal === meal);

  const go = (n: number) =>
    setSelectedDate(toISO(addDays(new Date(selectedDate + 'T00:00:00'), n)));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          onClick={() => go(-1)}
          className="p-2 rounded-xl hover:bg-surface-2 text-ink-muted transition-colors"
        >
          <ChevronLeft size={20} />
        </button>
        <span className="text-sm font-semibold text-ink">{formatDay(selectedDate)}</span>
        <button
          disabled={isToday}
          onClick={() => go(1)}
          className="p-2 rounded-xl hover:bg-surface-2 text-ink-muted disabled:opacity-30 transition-colors"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      <Card className="p-5 flex flex-col items-center">
        <Ring value={t.calories} max={targets.cal} />
        <div className="mt-5 w-full grid grid-cols-2 gap-x-6 gap-y-3">
          <MacroBar label="Protein" value={t.protein} target={targets.protein} color={COLORS.protein} />
          <MacroBar label="Carbs"   value={t.carbs}   target={targets.carbs}   color={COLORS.carbs} />
          <MacroBar label="Fat"     value={t.fat}     target={targets.fat}     color={COLORS.fat} />
          <MacroBar label="Fibre"   value={t.fibre}   target={targets.fibre}   color={COLORS.fibre} />
        </div>
      </Card>

      {MEALS.map(meal => (
        <MealSection
          key={meal}
          meal={meal}
          items={dayItems(meal)}
          onAdd={(foodId: number, qty: number) => addLog(meal, foodId, qty)}
          onUpdate={updateLog}
          onDelete={deleteLog}
        />
      ))}
    </div>
  );
}

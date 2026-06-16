'use client';

import { useState, useEffect } from 'react';
import { Plus, X, Trash2, Search, Loader2 } from 'lucide-react';
import { FoodResult, LogEntry } from '@/types';
import { allowDecimals } from '@/lib/validate';
import { api } from '@/lib/api';
import Card from '@/components/ui/Card';

interface MealSectionProps {
  meal: string;
  items: LogEntry[];
  onAdd: (foodId: number, qty: number) => void;
  onDelete: (id: string) => void;
}

function r(n: number, decimals = 1) {
  return Math.round(n * 10 ** decimals) / 10 ** decimals;
}

export default function MealSection({ meal, items, onAdd, onDelete }: MealSectionProps) {
  const [open, setOpen]                     = useState(false);
  const [search, setSearch]                 = useState('');
  const [results, setResults]               = useState<FoodResult[]>([]);
  const [selectedFood, setSelectedFood]     = useState<FoodResult | null>(null);
  const [qty, setQty]                       = useState('100');
  const [searching, setSearching]           = useState(false);
  const [searchErr, setSearchErr]           = useState<string | null>(null);

  // ── Debounced API search ──────────────────────────────────────────────
  useEffect(() => {
    if (search.trim().length < 2) { setResults([]); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      setSearchErr(null);
      try {
        const res = await api(`/foods/search?q=${encodeURIComponent(search.trim())}`);
        if (res.ok) {
          const data: FoodResult[] = await res.json();
          setResults(data);
          if (data.length > 0) setSelectedFood(data[0]);
        } else {
          const body = await res.json().catch(() => ({}));
          setSearchErr(typeof body?.error === 'string' ? body.error : `Search failed (${res.status})`);
        }
      } catch {
        setSearchErr('Cannot reach server');
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const total   = Math.round(items.reduce((s, i) => s + i.calories, 0));
  const qtyNum  = Number(qty) || 0;
  const preview = selectedFood && qtyNum > 0
    ? {
        calories: Math.round(selectedFood.caloriesPer100g * qtyNum / 100),
        protein:  r(selectedFood.protein * qtyNum / 100),
        carbs:    r(selectedFood.carbs * qtyNum / 100),
        fat:      r(selectedFood.fat * qtyNum / 100),
      }
    : null;

  const submit = () => {
    if (!selectedFood || !(qtyNum > 0)) return;
    onAdd(selectedFood.id, qtyNum);
    setQty('100');
    setSearch('');
    setResults([]);
    setSelectedFood(null);
    setOpen(false);
  };

  const close = () => {
    setOpen(false);
    setSearch('');
    setResults([]);
    setSelectedFood(null);
    setQty('100');
  };

  return (
    <Card className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-ink">{meal}</h3>
          <span className="text-xs text-ink-muted tabular-nums">{total} kcal</span>
        </div>
        <button
          onClick={() => (open ? close() : setOpen(true))}
          className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary-hover py-1.5 px-3 rounded-lg hover:bg-accent-soft transition-colors"
        >
          {open ? <X size={14} /> : <Plus size={14} />}
          {open ? 'Close' : 'Add'}
        </button>
      </div>

      {/* Log items */}
      {items.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {items.map(i => (
            <li key={i.id} className="flex items-center justify-between text-sm py-1">
              <div className="min-w-0 flex-1">
                <span className="text-ink">{i.name}</span>
                <span className="text-ink-muted text-xs"> · {i.qty}g</span>
              </div>
              <div className="flex items-center gap-3 shrink-0 ml-2">
                <span className="text-ink-muted tabular-nums text-xs">{i.calories} kcal</span>
                <button
                  onClick={() => onDelete(i.id)}
                  className="text-ink-muted hover:text-danger transition-colors p-0.5"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Add panel */}
      {open && (
        <div className="mt-3 pt-3 border-t border-line space-y-2">
          {/* Search input */}
          <div className="relative">
            {searching
              ? <Loader2 size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted animate-spin" />
              : <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
            }
            <input
              type="text"
              placeholder="Search foods (e.g. chicken, rice, dal)…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 rounded-lg border border-line text-sm text-ink bg-surface-2 outline-none focus:border-primary transition-colors"
              autoFocus
            />
          </div>

          {/* Error */}
          {searchErr && (
            <p className="text-xs text-danger">{searchErr}</p>
          )}

          {/* Results list */}
          {results.length > 0 && (
            <div className="max-h-44 overflow-y-auto rounded-xl border border-line divide-y divide-line">
              {results.map(f => (
                <button
                  key={f.id}
                  onClick={() => setSelectedFood(f)}
                  className={`w-full flex justify-between items-center px-3 py-2.5 text-sm text-left transition-colors ${
                    selectedFood?.id === f.id
                      ? 'bg-accent-soft text-primary'
                      : 'text-ink hover:bg-surface-2'
                  }`}
                >
                  <span>{f.name}</span>
                  <span className="text-xs text-ink-muted ml-2 shrink-0 tabular-nums">
                    {Math.round(f.caloriesPer100g)} kcal/100g
                  </span>
                </button>
              ))}
            </div>
          )}

          {search.trim().length >= 2 && !searching && results.length === 0 && !searchErr && (
            <p className="text-xs text-ink-muted px-1">No results — try a different name</p>
          )}

          {/* Quantity + Add */}
          <div className="flex gap-2">
            <div className="flex-1 flex items-center rounded-lg border border-line bg-surface-2 px-3 py-2">
              <input
                type="text"
                inputMode="decimal"
                value={qty}
                onChange={e => { if (allowDecimals(e.target.value, 2)) setQty(e.target.value); }}
                onKeyDown={e => e.key === 'Enter' && submit()}
                className="w-full bg-transparent text-sm text-ink outline-none"
              />
              <span className="text-xs text-ink-muted">g</span>
            </div>
            <button
              onClick={submit}
              disabled={!selectedFood}
              className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-fg hover:bg-primary-hover disabled:opacity-40 transition-colors"
            >
              Add
            </button>
          </div>

          {/* Macro preview */}
          {preview && (
            <p className="text-xs text-ink-muted tabular-nums">
              ≈ {preview.calories} kcal · {preview.protein}p · {preview.carbs}c · {preview.fat}f
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

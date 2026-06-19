'use client';

import { useState, useEffect } from 'react';
import { Plus, X, Trash2, Search, Loader2, Pencil, Check, Ban, PencilLine } from 'lucide-react';
import { FoodResult, LogEntry } from '@/types';
import { allowDecimals } from '@/lib/validate';
import { api } from '@/lib/api';
import { useApp } from '@/context/AppContext';
import Card from '@/components/ui/Card';

interface MealSectionProps {
  meal: string;
  items: LogEntry[];
  isFasting?: boolean;
  onAdd: (foodId: number, qty: number) => void;
  onUpdate: (id: string, qty: number) => void;
  onDelete: (id: string) => void;
  onToggleFast?: () => void;
}

function r(n: number, decimals = 1) {
  return Math.round(n * 10 ** decimals) / 10 ** decimals;
}

// Blank custom-food draft (values are for one serving; serving weight is separate).
const emptyCustom = { name: '', serving: '100', calories: '', protein: '', carbs: '', fat: '', fibre: '' };

export default function MealSection({ meal, items, isFasting, onAdd, onUpdate, onDelete, onToggleFast }: MealSectionProps) {
  const { addCustomFood } = useApp();

  const [open, setOpen]                     = useState(false);
  const [search, setSearch]                 = useState('');
  const [results, setResults]               = useState<FoodResult[]>([]);
  const [selectedFood, setSelectedFood]     = useState<FoodResult | null>(null);
  const [qty, setQty]                       = useState('100');
  const [searching, setSearching]           = useState(false);
  const [searchErr, setSearchErr]           = useState<string | null>(null);

  // Custom "Others" food state
  const [customMode, setCustomMode] = useState(false);
  const [custom, setCustom]         = useState(emptyCustom);
  const [savingCustom, setSavingCustom] = useState(false);
  const [customErr, setCustomErr]   = useState<string | null>(null);

  // Inline edit state for an already-logged item.
  const [editId, setEditId]   = useState<string | null>(null);
  const [editQty, setEditQty] = useState('');

  // ── Debounced API search ──────────────────────────────────────────────
  useEffect(() => {
    if (customMode || search.trim().length < 2) { setResults([]); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      setSearchErr(null);
      try {
        const res = await api(`/foods/search?q=${encodeURIComponent(search.trim())}`);
        if (res.ok) {
          const data: FoodResult[] = await res.json();
          setResults(data);
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
  }, [search, customMode]);

  const total   = Math.round(items.reduce((s, i) => s + i.calories, 0));
  const qtyNum  = Number(qty) || 0;
  const preview = selectedFood && qtyNum > 0
    ? {
        calories: Math.round(selectedFood.caloriesPer100g * qtyNum / 100),
        protein:  r(selectedFood.protein * qtyNum / 100),
        carbs:    r(selectedFood.carbs * qtyNum / 100),
        fat:      r(selectedFood.fat * qtyNum / 100),
        fibre:    r(selectedFood.fibre * qtyNum / 100),
      }
    : null;

  // Pick a dish → drop it into the quantity step so the user can edit grams.
  const pick = (f: FoodResult) => {
    setSelectedFood(f);
    setQty('100');
    setResults([]);
    setSearch('');
  };

  const submit = () => {
    if (!selectedFood || !(qtyNum > 0)) return;
    onAdd(selectedFood.id, qtyNum);
    reset();
  };

  const reset = () => {
    setQty('100');
    setSearch('');
    setResults([]);
    setSelectedFood(null);
    setCustomMode(false);
    setCustom(emptyCustom);
    setCustomErr(null);
  };

  const close = () => { setOpen(false); reset(); };

  // ── Custom food handlers ──────────────────────────────────────────────
  const cu = (k: keyof typeof custom, v: string) => setCustom(c => ({ ...c, [k]: v }));
  const servingNum = Number(custom.serving) || 0;
  const customValid =
    custom.name.trim().length > 0 &&
    servingNum > 0 &&
    (['calories', 'protein', 'carbs', 'fat', 'fibre'] as const).every(k => custom[k] !== '' && Number(custom[k]) >= 0);

  const submitCustom = async () => {
    if (!customValid || savingCustom) return;
    setSavingCustom(true);
    setCustomErr(null);
    try {
      // Convert the per-serving values the user typed into the per-100g shape the DB stores.
      const factor = 100 / servingNum;
      const food = await addCustomFood({
        name:            custom.name.trim(),
        caloriesPer100g: Number(custom.calories) * factor,
        protein:         Number(custom.protein)  * factor,
        carbs:           Number(custom.carbs)    * factor,
        fat:             Number(custom.fat)      * factor,
        fibre:           Number(custom.fibre)    * factor,
      });
      onAdd(food.id, servingNum);   // log exactly the serving the user described
      close();
    } catch (e) {
      setCustomErr(e instanceof Error ? e.message : 'Failed to save food');
    } finally {
      setSavingCustom(false);
    }
  };

  // ── Inline edit handlers ──────────────────────────────────────────────
  const startEdit = (i: LogEntry) => { setEditId(i.id); setEditQty(String(i.qty)); };
  const cancelEdit = () => { setEditId(null); setEditQty(''); };
  const saveEdit = (id: string) => {
    const n = Number(editQty);
    if (n > 0) onUpdate(id, n);
    cancelEdit();
  };

  const customInput = 'w-full bg-surface-2 rounded-lg border border-line px-2.5 py-2 text-sm text-ink outline-none focus:border-primary transition-colors';

  return (
    <Card className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-ink">{meal}</h3>
          <span className="text-xs text-ink-muted tabular-nums">
            {total} kcal{isFasting && ' · fasting'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {onToggleFast && (
            <button
              onClick={onToggleFast}
              title={isFasting ? 'Fasting — counts toward your streak. Tap to undo.' : 'Skipping this meal? Mark it as a fast so it keeps your streak.'}
              className={`flex items-center gap-1.5 text-xs font-semibold py-1.5 px-3 rounded-lg transition-colors ${
                isFasting
                  ? 'text-primary bg-accent-soft'
                  : 'text-ink-muted hover:bg-surface-2 hover:text-ink'
              }`}
            >
              <Ban size={13} />
              {isFasting ? 'Fasting' : 'Fast'}
            </button>
          )}
          <button
            onClick={() => (open ? close() : setOpen(true))}
            className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary-hover py-1.5 px-3 rounded-lg hover:bg-accent-soft transition-colors"
          >
            {open ? <X size={14} /> : <Plus size={14} />}
            {open ? 'Close' : 'Add'}
          </button>
        </div>
      </div>

      {isFasting && items.length === 0 && (
        <p className="mt-3 text-xs text-ink-muted flex items-center gap-1.5">
          <Ban size={13} className="text-primary" /> Marked as a fast — this won&apos;t break your streak.
        </p>
      )}

      {/* Log items */}
      {items.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {items.map(i => (
            <li key={i.id} className="text-sm py-1">
              {editId === i.id ? (
                /* ── Inline edit row ── */
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-ink">{i.name}</span>
                  <div className="flex items-center rounded-lg border border-primary bg-surface-2 px-2 py-1">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={editQty}
                      autoFocus
                      onChange={e => { if (allowDecimals(e.target.value, 2)) setEditQty(e.target.value); }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') saveEdit(i.id);
                        if (e.key === 'Escape') cancelEdit();
                      }}
                      className="w-12 bg-transparent text-right text-sm text-ink outline-none tabular-nums"
                    />
                    <span className="text-xs text-ink-muted">g</span>
                  </div>
                  <button
                    onClick={() => saveEdit(i.id)}
                    className="text-primary hover:text-primary-hover p-1"
                    aria-label="Save"
                  >
                    <Check size={15} />
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="text-ink-muted hover:text-ink p-1"
                    aria-label="Cancel"
                  >
                    <X size={15} />
                  </button>
                </div>
              ) : (
                /* ── Display row ── */
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <span className="text-ink">{i.name}</span>
                    <span className="text-ink-muted text-xs"> · {i.qty}g</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="text-ink-muted tabular-nums text-xs">{i.calories} kcal</span>
                    <button
                      onClick={() => startEdit(i)}
                      className="text-ink-muted hover:text-primary transition-colors p-0.5"
                      aria-label="Edit"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => onDelete(i.id)}
                      className="text-ink-muted hover:text-danger transition-colors p-0.5"
                      aria-label="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Add panel */}
      {open && (
        <div className="mt-3 pt-3 border-t border-line space-y-2">
          {customMode ? (
            /* ── Custom "Others" food form ── */
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-ink flex items-center gap-1.5">
                  <PencilLine size={13} className="text-primary" /> Add a custom food
                </span>
                <button
                  onClick={() => { setCustomMode(false); setCustomErr(null); }}
                  className="text-xs font-medium text-ink-muted hover:text-ink"
                >
                  Back to search
                </button>
              </div>

              <input
                type="text"
                placeholder="Food name (e.g. Grandma's dal)"
                value={custom.name}
                maxLength={120}
                autoFocus
                onChange={e => cu('name', e.target.value)}
                className={customInput}
              />

              <div className="grid grid-cols-2 gap-2">
                {([
                  ['serving',  'Serving (g)'],
                  ['calories', 'Calories'],
                  ['protein',  'Protein (g)'],
                  ['carbs',    'Carbs (g)'],
                  ['fat',      'Fat (g)'],
                  ['fibre',    'Fibre (g)'],
                ] as const).map(([key, label]) => (
                  <label key={key} className="block">
                    <span className="text-[11px] text-ink-muted">{label}</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={custom[key]}
                      placeholder="0"
                      onChange={e => { if (allowDecimals(e.target.value, 2)) cu(key, e.target.value); }}
                      className={customInput}
                    />
                  </label>
                ))}
              </div>

              <p className="text-[11px] text-ink-muted">
                Enter the values for one serving — all fields are required. Saved to your foods for next time.
              </p>
              {customErr && <p className="text-xs text-danger">{customErr}</p>}

              <button
                onClick={submitCustom}
                disabled={!customValid || savingCustom}
                className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-fg hover:bg-primary-hover disabled:opacity-40 transition-colors"
              >
                {savingCustom ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Save &amp; add to {meal}
              </button>
            </>
          ) : !selectedFood ? (
            <>
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

              {searchErr && <p className="text-xs text-danger">{searchErr}</p>}

              {/* Results list — click to select */}
              {results.length > 0 && (
                <div className="max-h-44 overflow-y-auto rounded-xl border border-line divide-y divide-line">
                  {results.map(f => (
                    <button
                      key={f.id}
                      onClick={() => pick(f)}
                      className="w-full flex justify-between items-center px-3 py-2.5 text-sm text-left text-ink hover:bg-surface-2 transition-colors"
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
                <p className="text-xs text-ink-muted px-1">No results — add it as a custom food below</p>
              )}

              {/* Others → custom food */}
              <button
                onClick={() => { setCustomMode(true); setSearch(''); setResults([]); setSearchErr(null); }}
                className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-line py-2 text-xs font-semibold text-ink-muted hover:text-primary hover:border-primary transition-colors"
              >
                <PencilLine size={13} /> Others — add a food not listed
              </button>
            </>
          ) : (
            <>
              {/* Selected dish → edit grams → add */}
              <div className="flex items-center justify-between rounded-lg bg-accent-soft px-3 py-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-primary truncate">{selectedFood.name}</div>
                  <div className="text-xs text-ink-muted tabular-nums">
                    {Math.round(selectedFood.caloriesPer100g)} kcal/100g
                  </div>
                </div>
                <button
                  onClick={reset}
                  className="text-xs font-medium text-ink-muted hover:text-ink shrink-0 ml-2"
                >
                  Change
                </button>
              </div>

              <div className="flex gap-2">
                <div className="flex-1 flex items-center rounded-lg border border-line bg-surface-2 px-3 py-2">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={qty}
                    autoFocus
                    onChange={e => { if (allowDecimals(e.target.value, 2)) setQty(e.target.value); }}
                    onKeyDown={e => e.key === 'Enter' && submit()}
                    className="w-full bg-transparent text-sm text-ink outline-none"
                  />
                  <span className="text-xs text-ink-muted">g</span>
                </div>
                <button
                  onClick={submit}
                  disabled={!(qtyNum > 0)}
                  className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-fg hover:bg-primary-hover disabled:opacity-40 transition-colors"
                >
                  Add
                </button>
              </div>

              {/* Live macro preview */}
              {preview && (
                <p className="text-xs text-ink-muted tabular-nums">
                  ≈ {preview.calories} kcal · {preview.protein}p · {preview.carbs}c · {preview.fat}f · {preview.fibre} fibre
                </p>
              )}
            </>
          )}
        </div>
      )}
    </Card>
  );
}

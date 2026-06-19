import { env } from '../config/env';
import { getJSON, postJSON } from '../config/http';
import { prisma } from '../db/client';
import { Food } from '@prisma/client';

export interface FoodResult {
  id: number;
  name: string;
  caloriesPer100g: number;
  protein: number;
  carbs: number;
  fat: number;
  fibre: number;
  source: string;
}

type NewFood = Omit<FoodResult, 'id'>;

function round2(n: number) { return Math.round(n * 100) / 100; }
function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? round2(n) : 0;
}

// ─── USDA FoodData Central (primary) ────────────────────────────────────────
// Free. Get a key at https://fdc.nal.usda.gov/api-key-signup.html
// DEMO_KEY works but is heavily rate-limited (≈30/hr) — set FDC_API_KEY.

const FDC_KEY = env.FDC_API_KEY || 'DEMO_KEY';
const FDC_DATATYPES = ['Foundation', 'SR Legacy', 'Survey (FNDDS)', 'Branded'];

interface FDCNutrient { nutrientId?: number; value?: number }
interface FDCFood { description?: string; foodNutrients?: FDCNutrient[] }

// USDA nutrient ids
const N_ENERGY = 1008, N_PROTEIN = 1003, N_CARB = 1005, N_FAT = 1004, N_FIBRE = 1079;

function pick(arr: FDCNutrient[] | undefined, id: number): number {
  return num(arr?.find(n => n.nutrientId === id)?.value);
}

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

async function searchUSDA(query: string): Promise<NewFood[]> {
  // POST (JSON body) — the GET endpoint returns nginx 400 for some encoded queries.
  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${FDC_KEY}`;
  const data = await postJSON<{ foods?: FDCFood[] }>(url, {
    query,
    pageSize: 20,
    dataType: FDC_DATATYPES,
  });
  const out: NewFood[] = [];
  for (const f of data.foods ?? []) {
    const name = f.description?.trim();
    const kcal = pick(f.foodNutrients, N_ENERGY);
    if (!name || kcal <= 0) continue;
    out.push({
      name:            titleCase(name).slice(0, 120),
      caloriesPer100g: kcal,
      protein:         pick(f.foodNutrients, N_PROTEIN),
      carbs:           pick(f.foodNutrients, N_CARB),
      fat:             pick(f.foodNutrients, N_FAT),
      fibre:           pick(f.foodNutrients, N_FIBRE),
      source:          'usda',
    });
  }
  return out;
}

// ─── Open Food Facts (fallback) ─────────────────────────────────────────────
// Free, no key. Used when USDA returns nothing.

const OFF_URL = 'https://search.openfoodfacts.org/search';

interface OFFNutriments {
  'energy-kcal_100g'?: number | string;
  proteins_100g?: number | string;
  carbohydrates_100g?: number | string;
  fat_100g?: number | string;
  fiber_100g?: number | string;
}
interface OFFProduct { product_name?: string; brands?: string | string[]; nutriments?: OFFNutriments }

async function searchOFF(query: string): Promise<NewFood[]> {
  const url =
    `${OFF_URL}?q=${encodeURIComponent(query)}` +
    `&page_size=20&fields=product_name,brands,nutriments`;

  const body = await getJSON<{ hits?: OFFProduct[] }>(url, {
    'User-Agent': 'Thali/0.1 (calorie tracker)',
  });
  const out: NewFood[] = [];
  for (const p of body.hits ?? []) {
    const name = p.product_name?.trim();
    const kcal = Number(p.nutriments?.['energy-kcal_100g']);
    if (!name || !Number.isFinite(kcal) || kcal <= 0) continue;
    const brandsArr = Array.isArray(p.brands) ? p.brands : p.brands ? p.brands.split(',') : [];
    const brand = brandsArr[0]?.trim();
    out.push({
      name:            (brand ? `${name} (${brand})` : name).slice(0, 120),
      caloriesPer100g: round2(kcal),
      protein:         num(p.nutriments?.proteins_100g),
      carbs:           num(p.nutriments?.carbohydrates_100g),
      fat:             num(p.nutriments?.fat_100g),
      fibre:           num(p.nutriments?.fiber_100g),
      source:          'openfoodfacts',
    });
  }
  return out;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function toResult(f: Food): FoodResult {
  return {
    id:              Number(f.id),
    name:            f.name,
    caloriesPer100g: Number(f.caloriesPer100g),
    protein:         Number(f.protein),
    carbs:           Number(f.carbs),
    fat:             Number(f.fat),
    fibre:           Number(f.fibre),
    source:          f.source,
  };
}

/** Best-effort: try USDA, fall back to Open Food Facts. Never throws if one works. */
async function fetchFromApis(query: string): Promise<NewFood[]> {
  let usda: NewFood[] = [];
  try {
    usda = await searchUSDA(query);
  } catch (err) {
    console.warn('[nutrition] USDA failed:', (err as Error).message);
  }
  if (usda.length > 0) return usda;

  try {
    return await searchOFF(query);
  } catch (err) {
    console.warn('[nutrition] OFF failed:', (err as Error).message);
    // Only surface an error if BOTH sources failed AND we have nothing.
    if (usda.length === 0) throw new Error('Food lookup is temporarily unavailable. Please try again.');
    return usda;
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

// Persist API results so repeat searches are instant. Sequential — the pooled
// DATABASE_URL runs with connection_limit=1.
async function persist(items: NewFood[]): Promise<FoodResult[]> {
  const byKey = new Map<string, NewFood>();
  for (const it of items) {
    const k = `${it.name}::${it.source}`;
    if (!byKey.has(k)) byKey.set(k, it);
  }
  const saved: Food[] = [];
  for (const data of byKey.values()) {
    saved.push(
      await prisma.food.upsert({
        where:  { name_source: { name: data.name, source: data.source } },
        update: data,
        create: data,
      })
    );
  }
  return saved.map(toResult);
}

/**
 * Search for foods from BOTH the local DB (custom + cached) AND the live APIs,
 * merged. The DB is never the sole source — fresh API matches always surface
 * too. Custom dishes (added by any user) rank first.
 */
export async function searchFoods(query: string): Promise<FoodResult[]> {
  // Run DB and external lookups together; the API call is the slow leg.
  const [cached, apiResult] = await Promise.all([
    prisma.food.findMany({
      where: { name: { contains: query, mode: 'insensitive' } },
      take: 25,
    }),
    fetchFromApis(query).catch(err => {
      console.warn('[nutrition] API search failed:', (err as Error).message);
      return null;   // tolerate — fall back to DB-only
    }),
  ]);

  const dbResults  = cached.map(toResult);
  const apiResults = apiResult ? await persist(apiResult) : [];

  // Both sources empty AND the API actually errored → surface the failure.
  if (dbResults.length === 0 && apiResult === null) {
    throw new Error('Food lookup is temporarily unavailable. Please try again.');
  }

  // Merge, dedup by name (case-insensitive). Custom dishes first, then the rest
  // of the DB cache, then anything new from the API.
  const ordered = [
    ...dbResults.filter(f => f.source === 'custom'),
    ...dbResults.filter(f => f.source !== 'custom'),
    ...apiResults,
  ];
  const seen = new Set<string>();
  const out: FoodResult[] = [];
  for (const f of ordered) {
    const key = f.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out.slice(0, 25);
}

export interface CustomFoodInput {
  name:            string;
  caloriesPer100g: number;
  protein:         number;
  carbs:           number;
  fat:             number;
  fibre:           number;
}

/**
 * Persist a custom "Others" dish. Shared globally — once any user adds it, it
 * shows up in everyone's searches. Re-adding the same name overwrites it.
 */
export async function createCustomFood(input: CustomFoodInput): Promise<FoodResult> {
  const data = {
    name:            titleCase(input.name.trim()).slice(0, 120),
    caloriesPer100g: round2(input.caloriesPer100g),
    protein:         round2(input.protein),
    carbs:           round2(input.carbs),
    fat:             round2(input.fat),
    fibre:           round2(input.fibre),
    source:          'custom',
  };
  const row = await prisma.food.upsert({
    where:  { name_source: { name: data.name, source: 'custom' } },
    update: data,
    create: data,
  });
  return toResult(row);
}

/** Fetch a single food by ID (used internally by foodLog service). */
export async function getFoodById(id: bigint): Promise<Food> {
  return prisma.food.findUniqueOrThrow({ where: { id } });
}

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

export interface LogEntry {
  id: string;
  date: string;        // YYYY-MM-DD
  meal: string;
  foodId: number;
  name: string;
  qty: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fibre: number;
}

// Field names match the backend (Prisma camelCase of snake_case columns)
export interface Profile {
  sex: 'male' | 'female';
  age: number;
  heightCm: number;
  weightKg: number;
  activityLevel: number;
  goal: 'cut' | 'maintain' | 'bulk';
  name?: string;
}

export interface Targets {
  bmr: number;
  tdee: number;
  cal: number;
  protein: number;
  carbs: number;
  fat: number;
  fibre: number;
}

export interface DaySummary {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fibre: number;
}

export interface WeightEntry {
  id: number;
  date: string;        // YYYY-MM-DD
  weightKg: number;
}

// A meal the user deliberately skipped (fasting) — counts toward consistency.
export interface FastEntry {
  date: string;        // YYYY-MM-DD
  meal: string;
}

// Payload for a user-created "Others" dish (values per 100g).
export interface CustomFoodInput {
  name: string;
  caloriesPer100g: number;
  protein: number;
  carbs: number;
  fat: number;
  fibre: number;
}

export type TabId = 'today' | 'week' | 'month' | 'profile';

// Month-view range selector
export type MonthRange = 'month' | '3m' | '6m' | 'year' | 'all';

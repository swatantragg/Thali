// Data-viz palette — chosen to stay legible on BOTH the cream (light) and
// forest (dark) surfaces, harmonized with the brand greens.
export const COLORS = {
  cal: '#85A947',      // sage — primary metric (rings, bars, trend)
  protein: '#6366f1',  // indigo
  carbs: '#E0A11B',    // amber
  fat: '#EC4F63',      // rose
  fibre: '#14B8A6',    // teal
  over: '#E0533F',     // warm red
} as const;

export const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snack'] as const;
export type Meal = typeof MEALS[number];

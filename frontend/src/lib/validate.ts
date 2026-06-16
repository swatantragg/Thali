// Input guards for numeric fields.

/** True if `value` is empty or a number with at most `decimals` decimal places. */
export function allowDecimals(value: string, decimals = 2): boolean {
  if (value === '') return true;
  return new RegExp(`^\\d*(\\.\\d{0,${decimals}})?$`).test(value);
}

/** True if `value` is empty or a non-negative integer. */
export function allowInteger(value: string): boolean {
  return value === '' || /^\d+$/.test(value);
}

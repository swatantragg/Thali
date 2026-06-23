'use client';

import { useEffect, useRef, useState } from 'react';
import { allowDecimals } from '@/lib/validate';

interface DecimalInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: number;
  onValueChange: (n: number) => void;
  decimals?: number;
}

/**
 * Controlled numeric input that accepts up to `decimals` decimal places.
 *
 * Holds its own text state so an in-progress value like "72." (or "72.0")
 * isn't normalised away mid-typing — binding `value` straight to a number
 * coerces "72." → 72 on every keystroke and strips the decimal point before
 * the user can type the digits after it.
 */
export default function DecimalInput({
  value, onValueChange, decimals = 2, ...props
}: DecimalInputProps) {
  const [text, setText] = useState(String(value));
  const focused = useRef(false);

  // Sync from the parent's number when the field isn't being edited
  // (initial load, weigh-in auto-fill, edit-cancel reset, …) and only when
  // it actually differs from what's typed (so "72." / "72.50" survive).
  useEffect(() => {
    if (!focused.current && Number(text) !== value) setText(String(value));
  }, [value, text]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (!allowDecimals(raw, decimals)) return;   // reject 3rd decimal / junk
    setText(raw);
    if (raw !== '' && Number.isFinite(Number(raw))) onValueChange(Number(raw));
  };

  return (
    <input
      {...props}
      type="text"
      inputMode="decimal"
      value={text}
      onFocus={e => { focused.current = true; props.onFocus?.(e); }}
      onBlur={e => {
        focused.current = false;
        // Normalise the display to the canonical number on blur.
        setText(value ? String(value) : '');
        props.onBlur?.(e);
      }}
      onChange={handleChange}
    />
  );
}

'use client';

import { ChevronDown } from 'lucide-react';

interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  children: React.ReactNode;
}

/** Themed <select> with a custom chevron (native arrow removed). */
export default function Select({ children, className = '', ...props }: SelectProps) {
  return (
    <div className="relative inline-flex items-center">
      <select
        {...props}
        className={`appearance-none cursor-pointer pr-8 ${className}`}
      >
        {children}
      </select>
      <ChevronDown
        size={14}
        className="pointer-events-none absolute right-2.5 text-ink-muted"
      />
    </div>
  );
}

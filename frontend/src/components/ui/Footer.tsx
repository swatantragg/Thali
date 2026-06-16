'use client';

/** Fixed bottom-right copyright. Visible in both themes. */
export default function Footer() {
  return (
    <footer className="fixed bottom-2 right-3 z-30 pointer-events-none select-none">
      <p className="text-[11px] text-ink-muted">
        Copyright © Avita Technologies · in collaboration with SetsWithSK
      </p>
    </footer>
  );
}

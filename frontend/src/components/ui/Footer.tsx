'use client';

/** Fixed bottom-right copyright. Visible in both themes. */
export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="fixed bottom-2 right-3 z-30 pointer-events-none select-none text-right">
      <p className="text-[11px] text-ink-muted leading-tight">
        © {year} | Thali
        <br />
        Website Developed &amp; Maintained by Avita Technologies
      </p>
    </footer>
  );
}

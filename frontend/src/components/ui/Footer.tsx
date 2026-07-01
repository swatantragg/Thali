'use client';

import { useAuth } from '@/context/AuthContext';
import { useApp } from '@/context/AppContext';

const VERSION = 'SK-V1.3';
const AVITA = 'Website Developed & Maintained by Avita Technologies';

/**
 * Fixed bottom-right badge. The version tag is always shown; the line above it
 * is the Avita credit on the login page + Profile tab, and the Thali copyright
 * everywhere else. Visible in both themes.
 */
export default function Footer() {
  const year = new Date().getFullYear();
  const { user } = useAuth();
  const { tab } = useApp();
  const showAvita = !user || tab === 'profile';

  return (
    <footer className="fixed bottom-2 right-3 z-30 pointer-events-none select-none text-right">
      <p className="text-[11px] text-ink-muted leading-tight">
        {showAvita ? AVITA : `© ${year} | Thali`}
        <br />
        {VERSION}
      </p>
    </footer>
  );
}

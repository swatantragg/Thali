'use client';

import { useEffect, useState } from 'react';
import { Bell, BellOff, Loader2, Check } from 'lucide-react';
import Card from '@/components/ui/Card';
import {
  isPushSupported, pushPermission, isPushEnabled,
  enablePush, disablePush, sendTestPush,
} from '@/lib/push';

// iOS only delivers Web Push when the PWA is installed to the Home Screen.
function iosNeedsInstall(): boolean {
  if (typeof navigator === 'undefined') return false;
  const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent);
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  return isIOS && !standalone;
}

export default function ReminderCard() {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled]     = useState(false);
  const [busy, setBusy]           = useState(false);
  const [tested, setTested]       = useState(false);
  const [err, setErr]             = useState<string | null>(null);
  const [denied, setDenied]       = useState(false);
  const [needsInstall, setNeedsInstall] = useState(false);

  useEffect(() => {
    const ok = isPushSupported();
    setSupported(ok);
    setNeedsInstall(iosNeedsInstall());
    if (!ok) return;
    setDenied(pushPermission() === 'denied');
    isPushEnabled().then(setEnabled).catch(() => {});
  }, []);

  if (!supported) return null;

  const toggle = async () => {
    setBusy(true);
    setErr(null);
    try {
      if (enabled) { await disablePush(); setEnabled(false); }
      else         { await enablePush();  setEnabled(true); setDenied(false); }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Something went wrong');
      if (pushPermission() === 'denied') setDenied(true);
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setErr(null);
    try {
      await sendTestPush();
      setTested(true);
      setTimeout(() => setTested(false), 2500);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Test failed');
    }
  };

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-ink">
            {enabled ? <Bell size={15} className="text-primary" /> : <BellOff size={15} className="text-ink-muted" />}
            Meal reminders
          </div>
          <p className="text-xs text-ink-muted mt-1">
            A nightly nudge at <span className="font-medium text-ink">10:30 PM</span> if you haven’t
            logged all your meals — with a fresh dose of motivation. 🌙
          </p>
        </div>

        <button
          onClick={toggle}
          disabled={busy || denied}
          className={`shrink-0 flex items-center gap-1.5 text-xs font-semibold py-1.5 px-3 rounded-lg transition-colors disabled:opacity-50 ${
            enabled
              ? 'text-ink-muted hover:text-ink hover:bg-surface-2'
              : 'text-primary-fg bg-primary hover:bg-primary-hover'
          }`}
        >
          {busy ? <Loader2 size={13} className="animate-spin" /> : null}
          {enabled ? 'Turn off' : 'Turn on'}
        </button>
      </div>

      {enabled && (
        <button
          onClick={test}
          className="mt-3 flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary-hover transition-colors"
        >
          {tested ? <Check size={13} /> : null}
          {tested ? 'Test sent — check your notifications' : 'Send a test notification'}
        </button>
      )}

      {denied && (
        <p className="text-xs text-danger mt-2">
          Notifications are blocked. Enable them for this site in your browser settings, then try again.
        </p>
      )}
      {needsInstall && !enabled && (
        <p className="text-[11px] text-ink-muted mt-2">
          On iPhone/iPad, add Thali to your Home Screen first (Share → Add to Home Screen) to receive reminders.
        </p>
      )}
      {err && !denied && <p className="text-xs text-danger mt-2">{err}</p>}
    </Card>
  );
}

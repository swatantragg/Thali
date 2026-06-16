'use client';

import { useEffect, useRef } from 'react';

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

interface GoogleButtonProps {
  onCredential: (credential: string) => void;
  onError?: (message: string) => void;
}

/** Renders the Google Identity Services "Continue with Google" button. */
export default function GoogleButton({ onCredential, onError }: GoogleButtonProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!CLIENT_ID) return;

    const SCRIPT_ID = 'google-gsi-client';

    function init() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const g = (window as any).google;
      if (!g?.accounts?.id || !ref.current) return;
      g.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: (resp: { credential?: string }) => {
          if (resp.credential) onCredential(resp.credential);
        },
      });
      g.accounts.id.renderButton(ref.current, {
        theme: 'outline',
        size: 'large',
        width: ref.current.offsetWidth || 320,
        text: 'continue_with',
        shape: 'pill',
      });
    }

    if (document.getElementById(SCRIPT_ID)) { init(); return; }

    const s = document.createElement('script');
    s.id = SCRIPT_ID;
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.defer = true;
    s.onload = init;
    s.onerror = () => onError?.('Could not load Google sign-in');
    document.body.appendChild(s);
  }, [onCredential, onError]);

  if (!CLIENT_ID) {
    return (
      <button
        type="button"
        disabled
        title="Set NEXT_PUBLIC_GOOGLE_CLIENT_ID to enable Google sign-in"
        className="w-full rounded-full border border-line py-2.5 text-sm font-medium text-ink-muted cursor-not-allowed"
      >
        Continue with Google (not configured)
      </button>
    );
  }

  return <div ref={ref} className="w-full flex justify-center min-h-[40px]" />;
}

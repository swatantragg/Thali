import { NextRequest, NextResponse } from 'next/server';

/**
 * Per-request Content-Security-Policy with a fresh nonce.
 *
 * A nonce-based CSP is the strongest practical XSS defence: even if an attacker
 * injects a <script>, the browser refuses to run it because it lacks the
 * one-time nonce. 'strict-dynamic' lets our nonced bundle load the Google
 * Identity script at runtime without an origin allowlist.
 *
 * Next.js automatically stamps this nonce onto the scripts it emits when it
 * sees the `Content-Security-Policy` request header set below.
 */
export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');

  const isProd = process.env.NODE_ENV === 'production';

  const csp = [
    `default-src 'self'`,
    // strict-dynamic + nonce for modern browsers; https:/unsafe-inline are the
    // ignored fallback for legacy engines that don't support strict-dynamic.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https: 'unsafe-inline'`,
    // Tailwind/Next/recharts emit inline styles; Google Fonts stylesheet.
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    `font-src 'self' https://fonts.gstatic.com`,
    `img-src 'self' data: blob: https://*.googleusercontent.com https://*.gstatic.com`,
    // Same-origin API (via the /api rewrite) + Google Identity endpoints.
    `connect-src 'self' https://accounts.google.com https://www.googleapis.com`,
    // Google "Continue with Google" button renders in a google.com iframe.
    `frame-src https://accounts.google.com https://*.google.com`,
    `worker-src 'self'`,
    `manifest-src 'self'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    ...(isProd ? [`upgrade-insecure-requests`] : []),
  ].join('; ');

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), browsing-topics=()');
  return response;
}

export const config = {
  // Run on pages only — skip the API proxy and static assets so we don't add a
  // nonce to the SW/manifest or interfere with the /api rewrite.
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|sw.js|manifest.json|logo.svg|icons/).*)',
  ],
};

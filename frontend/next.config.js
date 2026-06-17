/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',

  // Don't leak the framework version.
  poweredByHeader: false,

  // Proxy /api/* → backend — no hardcoded port in the browser bundle.
  // API_URL is server-side only (not NEXT_PUBLIC_), set per environment.
  async rewrites() {
    const dest = process.env.API_URL ?? 'http://localhost:5000';
    return [
      {
        source:      '/api/:path*',
        destination: `${dest}/api/:path*`,
      },
    ];
  },

  // Static security headers (backstop for every route). The per-request,
  // nonce-based Content-Security-Policy is set in middleware.ts.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=15552000; includeSubDomains; preload',
          },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;

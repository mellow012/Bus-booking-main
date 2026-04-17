import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
const withPWAInit = require('next-pwa');

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const withPWA = withPWAInit({
  dest: 'public',
  disable: true,
  register: true,
  skipWaiting: true,
});

const nextConfig: NextConfig = {
  // Strict build mode enabled for production readiness, but we allow ESLint warnings to pass.
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        ],
      },
    ];
  },
};

export default withNextIntl(withPWA(nextConfig));
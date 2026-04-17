import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['en', 'ny'],
  defaultLocale: 'en',
  localePrefix: 'never', // ← key line — no /ny/ in URLs ever
});
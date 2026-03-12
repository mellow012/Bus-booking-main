import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',

  // Tests share Firebase state — run sequentially to avoid auth conflicts
  fullyParallel: false,
  workers:       1,

  forbidOnly: !!process.env.CI,
  retries:    process.env.CI ? 1 : 0,
  reporter:   [['html', { open: 'never' }], ['list']],

  use: {
    baseURL:           'https://bus-booking-main-five.vercel.app',
    trace:             'on-first-retry',
    screenshot:        'only-on-failure',
    video:             'on-first-retry',
    actionTimeout:     15_000,
    navigationTimeout: 40_000,
  },

  projects: [
    // Primary — run all suites
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    // Cross-browser smoke — auth + customer only (faster)
    {
      name: 'firefox',
      use:  { ...devices['Desktop Firefox'] },
      testMatch: ['**/auth.spec.ts', '**/customer.spec.ts'],
    },
    {
      name: 'webkit',
      use:  { ...devices['Desktop Safari'] },
      testMatch: ['**/auth.spec.ts', '**/customer.spec.ts'],
    },

    // Mobile smoke
    {
      name: 'mobile-chrome',
      use:  { ...devices['Pixel 5'] },
      testMatch: ['**/auth.spec.ts', '**/customer.spec.ts'],
    },
    {
      name: 'mobile-safari',
      use:  { ...devices['iPhone 12'] },
      testMatch: ['**/auth.spec.ts'],
    },
  ],
});
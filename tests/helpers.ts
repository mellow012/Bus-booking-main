// tests/helpers.ts — shared utilities for all test suites
import { Page, expect } from '@playwright/test';

export const BASE_URL = 'https://bus-booking-main-five.vercel.app';

export const ACCOUNTS = {
  customer: { email: 'wiz116mlambia@gmail.com',     password: 'Abcd1234' },
  admin:    { email: 'quantumbyteslab012@gmail.com', password: 'Abcd1234' },
  operator: { email: 'trevortaulo03@gmail.com',      password: 'Abcd1234' },
  super:    { email: 'Mellow012@gmail.com',           password: 'abcd1234' },
};

// ─── Core ─────────────────────────────────────────────────────────────────────

/**
 * Wait for Next.js hydration to complete before interacting.
 * Prevents "element not attached" flakes on first render.
 */
export async function waitForHydration(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle').catch(() => {
    // networkidle can time out on pages with long-polling — ignore
  });
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function login(page: Page, role: keyof typeof ACCOUNTS) {
  const { email, password } = ACCOUNTS[role];
  await page.goto(`${BASE_URL}/login`);
  await page.waitForSelector('input[type="email"]', { timeout: 30_000 });
  await waitForHydration(page);
  await page.fill('input[type="email"]',    email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 40_000 });
  console.log(`[login:${role}] → ${page.url()}`);
}

export async function logout(page: Page) {
  const signOutBtn = page.locator(
    'button:has-text("Sign Out"), button:has-text("Logout"), a:has-text("Sign Out")'
  );
  if (await signOutBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await signOutBtn.click();
  } else {
    // Some layouts hide it behind a user menu — try opening it first
    const userMenu = page.locator(
      '[data-testid="user-menu"], button[aria-label*="user" i], button[aria-label*="account" i]'
    );
    if (await userMenu.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await userMenu.click();
      await page.locator('button:has-text("Sign Out"), a:has-text("Sign Out")').first().click();
    }
  }
  await page.waitForURL(/\/login/, { timeout: 15_000 });
}

// ─── Modals / overlays ────────────────────────────────────────────────────────

/**
 * Dismiss the city-picker modal that appears on first homepage visit.
 * Tries close button by aria-label first, falls back to Escape key.
 */
export async function dismissCityPicker(page: Page) {
  const modal = page.locator('text=Your City').first();
  if (await modal.isVisible({ timeout: 4_000 }).catch(() => false)) {
    // Prefer explicit close button; last SVG button in the modal is the ✕
    const closeBtn = page.locator('[aria-label="Close"], [data-testid="close-modal"]').first();
    if (await closeBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await closeBtn.click();
    } else {
      await page.keyboard.press('Escape');
    }
    await modal.waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => {});
  }
}

export async function dismissToast(page: Page) {
  const toast = page.locator('[role="alert"], [data-testid="toast"]').first();
  if (await toast.isVisible({ timeout: 2_000 }).catch(() => false)) {
    const closeBtn = toast.locator('button');
    if (await closeBtn.isVisible({ timeout: 1_000 }).catch(() => false)) await closeBtn.click();
    else await page.keyboard.press('Escape');
  }
}

// ─── Search helpers ───────────────────────────────────────────────────────────

export async function searchRoute(
  page: Page,
  from: string,
  to: string,
  date?: string,
) {
  await page.goto(`${BASE_URL}/`);
  await page.waitForSelector('#search-from', { timeout: 30_000 });
  await dismissCityPicker(page);

  await page.fill('#search-from', from);
  await page.locator(`[role="option"]:has-text("${from}")`).first().click().catch(() => {});

  await page.fill('#search-to', to);
  await page.locator(`[role="option"]:has-text("${to}")`).first().click().catch(() => {});

  if (date) await page.locator('input[type="date"]').fill(date);

  await Promise.all([
    page.waitForURL(url => url.pathname === '/search', { timeout: 30_000 }),
    page.click('button:has-text("Search Buses")'),
  ]);
}

// ─── Booking helpers ──────────────────────────────────────────────────────────

export async function selectStops(page: Page) {
  const boardAt = page.locator('#boardAt, select[name="boardAt"]');
  await boardAt.waitFor({ timeout: 30_000 });
  const boardOpts = await boardAt.locator('option:not([value=""]):not([disabled])').all();
  if (boardOpts.length) await boardAt.selectOption(await boardOpts[0].getAttribute('value') ?? '');

  const alightAt = page.locator('#alightAt, select[name="alightAt"]');
  await alightAt.waitFor({ timeout: 10_000 });
  const alightOpts = await alightAt.locator('option:not([value=""]):not([disabled])').all();
  if (alightOpts.length) await alightAt.selectOption(await alightOpts[alightOpts.length - 1].getAttribute('value') ?? '');

  await page.waitForTimeout(1_500);
}

export async function selectFirstAvailableSeat(page: Page) {
  const seat = page.locator(
    'button[data-seat-status="available"]:not([disabled]), ' +
    'button.seat:not(.booked):not(.occupied):not([disabled]), ' +
    '[aria-label*="available" i]:not([disabled])',
  ).first();
  await seat.waitFor({ timeout: 30_000 });
  await seat.click();
  console.log('[seat] selected');
}

export async function fillPassengerForm(page: Page, name = 'Test Wisdom') {
  await page.waitForSelector('input[name="name"], input[placeholder*="name" i]', { timeout: 60_000 });
  await page.fill('input[name="name"], input[placeholder*="name" i]', name);
  const age = page.locator('input[name="ageInput"], input[name="age"]');
  if (await age.isVisible().catch(() => false)) await age.fill('28');
  const gender = page.locator('select[name="gender"]');
  if (await gender.isVisible().catch(() => false)) await gender.selectOption('male');
  const phone = page.locator('input[name="phone"], input[type="tel"]');
  if (await phone.isVisible().catch(() => false)) await phone.fill('+265999999999');
}

// ─── Payment helpers ──────────────────────────────────────────────────────────

export async function selectPaymentMethod(
  page: Page,
  method: 'airtel' | 'tnm' | 'card' | 'cash',
) {
  const labels: Record<typeof method, string> = {
    airtel: 'Airtel Money',
    tnm:    'TNM Mpamba',
    card:   'Visa',
    cash:   'Cash',
  };
  const btn = page.locator(
    `button:has-text("${labels[method]}"), label:has-text("${labels[method]}")`
  ).first();
  if (await btn.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await btn.click();
    console.log(`[payment] selected ${labels[method]}`);
  } else {
    console.log(`[payment] "${labels[method]}" not visible — skipping`);
  }
}

export async function handlePaymentGateway(page: Page) {
  const url = page.url();
  if (url.includes('paychangu')) {
    const input = page.locator('input[placeholder*="Mobile" i], input[placeholder*="Phone" i], input[type="tel"]');
    await input.waitFor({ timeout: 20_000 });
    await input.fill('0991457496');
    await page.click('button:has-text("Confirm"), button:has-text("Pay"), button[type="submit"]');
  } else if (url.includes('flutterwave')) {
    await page.waitForSelector('#cardnumber, input[placeholder*="Card"]', { timeout: 20_000 });
    await page.fill('#cardnumber, input[placeholder*="Card number" i]', '5531886652142950');
    await page.fill('#expiry,    input[placeholder*="MM" i]',            '09/32');
    await page.fill('#cvv,       input[placeholder*="CVV" i]',           '564');
    await page.click('button[type="submit"]');
  }
}

// ─── Assertions ───────────────────────────────────────────────────────────────

export async function expectSuccess(page: Page, keywords: string[]) {
  const selector = keywords.map(k => `text=${k}`).join(', ');
  await expect(page.locator(selector).first()).toBeVisible({ timeout: 15_000 });
}

/** @deprecated use assertNoErrors */
export async function expectNoError(page: Page) {
  await assertNoErrors(page);
}

/** Assert no visible error banners / alerts on the page. */
export async function assertNoErrors(page: Page) {
  const err = page
    .locator(
      '[role="alert"]:has-text("Error"), [role="alert"]:has-text("Failed"), ' +
      '.text-red-700, .text-rose-600, [data-testid="error-banner"]'
    )
    .first();
  const shown = await err.isVisible({ timeout: 2_000 }).catch(() => false);
  if (shown) {
    const text = await err.textContent().catch(() => '(unreadable)');
    throw new Error(`Unexpected error on page: "${text?.trim()}"`);
  }
}

// ─── Form helpers ─────────────────────────────────────────────────────────────

/**
 * Fill a visible input by selector; silently skips if the element isn't visible.
 * Useful for optional fields that may or may not appear in a form.
 */
export async function fillIfVisible(page: Page, selector: string, value: string) {
  const el = page.locator(selector).first();
  const ok = await el.isVisible({ timeout: 3_000 }).catch(() => false);
  if (ok) await el.fill(value);
}

// ─── Retry / polling ──────────────────────────────────────────────────────────

/**
 * Retry an async action up to `attempts` times with `delayMs` between tries.
 * Useful for Firestore-backed pages that take a moment to hydrate.
 */
export async function retryUntil<T>(
  fn: () => Promise<T>,
  attempts = 3,
  delayMs  = 1_500,
): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); } catch (e) {
      last = e;
      if (i < attempts - 1) await new Promise(r => setTimeout(r, delayMs));
    }
  }
  throw last;
}

// ─── URL helpers ──────────────────────────────────────────────────────────────

/** Wait until the current URL matches any of the given string/regex patterns. */
export async function waitForAnyURL(
  page: Page,
  patterns: (string | RegExp)[],
  timeout = 40_000,
) {
  await page.waitForURL(
    url => patterns.some(p =>
      typeof p === 'string' ? url.href.includes(p) : p.test(url.href)
    ),
    { timeout },
  );
}

// ─── Auth state (storageState support) ───────────────────────────────────────

import * as fs   from 'fs';
import * as path from 'path';

export const AUTH_STATE_DIR = path.join(__dirname, '.auth');

/** Returns the path where a role's storageState JSON is saved by global-setup. */
export function authStatePath(role: keyof typeof ACCOUNTS): string {
  if (!fs.existsSync(AUTH_STATE_DIR)) fs.mkdirSync(AUTH_STATE_DIR, { recursive: true });
  return path.join(AUTH_STATE_DIR, `${role}.json`);
}

// ─── Admin helpers ────────────────────────────────────────────────────────────

export async function clickTab(page: Page, label: string) {
  const tab = page.locator(
    `button:has-text("${label}"), [role="tab"]:has-text("${label}"), a:has-text("${label}")`
  ).first();
  await tab.waitFor({ timeout: 20_000 });
  await tab.click();
  await waitForHydration(page);
}

export function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

export function futureDateISO(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().split('T')[0];
}
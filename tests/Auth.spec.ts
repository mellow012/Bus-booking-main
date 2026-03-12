// tests/auth.spec.ts — Authentication flows for all roles
import { test, expect } from '@playwright/test';
import { BASE_URL, ACCOUNTS, login, logout } from './helpers';

test.describe('Authentication', () => {
  test.setTimeout(60_000);

  // ── Registration ────────────────────────────────────────────────────────────

  test('register with new email → lands on verify-email', async ({ page }) => {
    const unique = `test+${Date.now()}@mailinator.com`;
    await page.goto(`${BASE_URL}/register`);
    await page.waitForSelector('input[type="email"]');
    await page.fill('input[name="firstName"], input[placeholder*="First"]', 'Test');
    await page.fill('input[name="lastName"],  input[placeholder*="Last"]',  'User');
    await page.fill('input[type="email"]',    unique);
    await page.fill('input[type="password"]', 'TestPass123!');
    const confirmPwd = page.locator('input[name="confirmPassword"], input[placeholder*="Confirm"]');
    if (await confirmPwd.isVisible()) await confirmPwd.fill('TestPass123!');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/verify-email/, { timeout: 30_000 });
    await expect(page.locator('text=Check Your Email, text=Verify')).toBeVisible();
  });

  test('register with existing email → shows error', async ({ page }) => {
    await page.goto(`${BASE_URL}/register`);
    await page.waitForSelector('input[type="email"]');
    await page.fill('input[name="firstName"], input[placeholder*="First"]', 'Test');
    await page.fill('input[name="lastName"],  input[placeholder*="Last"]',  'User');
    await page.fill('input[type="email"]',    ACCOUNTS.customer.email);
    await page.fill('input[type="password"]', 'TestPass123!');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=already exists, text=already in use').first()).toBeVisible({ timeout: 10_000 });
  });

  // ── Login ───────────────────────────────────────────────────────────────────

  test('customer login → lands on /', async ({ page }) => {
    await login(page, 'customer');
    await expect(page).toHaveURL(`${BASE_URL}/`);
  });

  test('company admin login → lands on /company/admin', async ({ page }) => {
    await login(page, 'admin');
    await expect(page).toHaveURL(/\/company\/admin/);
  });

  test('operator login → lands on /company/operator/dashboard', async ({ page }) => {
    await login(page, 'operator');
    await expect(page).toHaveURL(/\/company\/operator\/dashboard/);
  });

  test('superadmin login → lands on /admin', async ({ page }) => {
    await login(page, 'super');
    await expect(page).toHaveURL(/\/admin/);
  });

  test('wrong password → shows error, does not redirect', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.waitForSelector('input[type="email"]');
    await page.fill('input[type="email"]',    ACCOUNTS.customer.email);
    await page.fill('input[type="password"]', 'wrongpassword99');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=Invalid, text=incorrect, text=wrong').first()).toBeVisible({ timeout: 10_000 });
    expect(page.url()).toContain('/login');
  });

  test('unauthenticated → /bookings redirects to /login', async ({ page }) => {
    await page.goto(`${BASE_URL}/bookings`);
    await page.waitForURL(/\/login/, { timeout: 15_000 });
  });

  test('unauthenticated → /book/* redirects to /login', async ({ page }) => {
    await page.goto(`${BASE_URL}/book/some-schedule-id`);
    await page.waitForURL(/\/login/, { timeout: 15_000 });
  });

  // ── Role isolation ──────────────────────────────────────────────────────────

  test('customer cannot access /company/admin', async ({ page }) => {
    await login(page, 'customer');
    await page.goto(`${BASE_URL}/company/admin`);
    // Should redirect away — either to / or /login
    await page.waitForURL(url => !url.pathname.startsWith('/company/admin'), { timeout: 15_000 });
  });

  test('operator cannot access /company/admin', async ({ page }) => {
    await login(page, 'operator');
    await page.goto(`${BASE_URL}/company/admin`);
    await page.waitForURL(url => !url.pathname.startsWith('/company/admin'), { timeout: 15_000 });
  });

  // ── Logout ──────────────────────────────────────────────────────────────────

  test('logout clears session → protected page redirects to /login', async ({ page }) => {
    await login(page, 'customer');
    await logout(page);
    await page.goto(`${BASE_URL}/bookings`);
    await page.waitForURL(/\/login/, { timeout: 15_000 });
  });
});
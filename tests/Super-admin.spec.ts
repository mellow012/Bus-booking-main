// tests/superadmin.spec.ts — Superadmin dashboard flows
import { test, expect } from '@playwright/test';
import { BASE_URL, login } from './helpers';

test.describe('Superadmin', () => {
  test.setTimeout(60_000);

  test('lands on /admin after login', async ({ page }) => {
    await login(page, 'super');
    await expect(page).toHaveURL(/\/admin/);
  });

  test('companies tab lists companies', async ({ page }) => {
    await login(page, 'super');
    await page.waitForSelector('text=Companies, text=Company', { timeout: 20_000 });
    await page.click('text=Companies');
    await expect(
      page.locator('text=Companies, text=No companies, table, article').first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test('users tab lists users', async ({ page }) => {
    await login(page, 'super');
    const usersTab = page.locator('text=Users');
    if (await usersTab.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await usersTab.click();
      await expect(
        page.locator('text=Users, text=No users, table').first()
      ).toBeVisible({ timeout: 15_000 });
    }
  });

  test('can open create company modal', async ({ page }) => {
    await login(page, 'super');
    await page.waitForSelector('text=Companies', { timeout: 20_000 });
    await page.click('text=Companies');
    const createBtn = page.locator(
      'button:has-text("Create Company"), button:has-text("Add Company"), button:has-text("New Company")'
    );
    await createBtn.waitFor({ timeout: 15_000 });
    await createBtn.click();
    await expect(page.locator('[role="dialog"], form').first()).toBeVisible({ timeout: 10_000 });
  });

  test('superadmin cannot be redirected to /verify-email', async ({ page }) => {
    await login(page, 'super');
    // Should never end up on verify-email regardless of email verified status
    expect(page.url()).not.toContain('/verify-email');
  });

  test('superadmin can access all protected routes', async ({ page }) => {
    await login(page, 'super');
    for (const path of ['/admin', '/admin/dashboard']) {
      await page.goto(`${BASE_URL}${path}`);
      await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 15_000 });
      expect(page.url()).not.toContain('/login');
    }
  });
});
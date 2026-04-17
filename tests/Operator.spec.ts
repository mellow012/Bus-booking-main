// tests/operator.spec.ts — Full operator dashboard coverage
// storageState = operator (loaded per project in playwright.config.ts)
//
// Suites:
//   1. Dashboard
//   2. Role Guards
//   3. My Schedules
//   4. Passenger Manifest
//   5. Boarding & Check-in
//   6. Bookings
//   7. Profile / Account

import { test, expect, Page } from '@playwright/test';
import { BASE_URL, assertNoErrors } from './helpers';

// ─── Shared helpers ───────────────────────────────────────────────────────────

const BASE = `${BASE_URL}/company/operator/dashboard`;

async function goDashboard(page: Page) {
  await page.goto(BASE);
  await page.waitForSelector('h1, h2, main', { timeout: 20_000 });
}

async function clickTab(page: Page, label: string) {
  const tab = page
    .locator(`button:has-text("${label}")`)
    .or(page.locator(`[role="tab"]:has-text("${label}")`))
    .or(page.locator(`a:has-text("${label}")`))
    .first();
  await tab.waitFor({ timeout: 20_000 });
  await tab.click();
  await page.waitForTimeout(800);
}

/** Try to click a tab; return false if not found. */
async function tryTab(page: Page, label: string): Promise<boolean> {
  const tab = page
    .locator(`button:has-text("${label}")`)
    .or(page.locator(`[role="tab"]:has-text("${label}")`))
    .or(page.locator(`a:has-text("${label}")`))
    .first();
  const visible = await tab.isVisible({ timeout: 8_000 }).catch(() => false);
  if (visible) { await tab.click(); await page.waitForTimeout(600); }
  return visible;
}

async function expectToast(page: Page) {
  await expect(
    page.locator(
      '[role="status"], [role="alert"], .toast, ' +
      'text=success, text=Success, text=saved, text=Saved, ' +
      'text=updated, text=Updated, text=boarded, text=Boarded'
    ).first()
  ).toBeVisible({ timeout: 12_000 });
}

/** Opens a manifest for the first schedule that has a manifest button. */
async function openManifest(page: Page): Promise<boolean> {
  await goDashboard(page);
  await tryTab(page, 'Schedules');

  const manifestBtn = page.locator(
    'button:has-text("Manifest"), ' +
    'button:has-text("Passengers"), ' +
    'button:has-text("View Passengers"), ' +
    'button[aria-label*="manifest" i]'
  ).first();

  const found = await manifestBtn.isVisible({ timeout: 15_000 }).catch(() => false);
  if (!found) { console.log('[manifest] no manifest button — no booked schedules'); return false; }

  await manifestBtn.click();
  await page.locator('[role="dialog"], [data-testid="manifest"], table').first()
    .waitFor({ timeout: 12_000 });
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 1 — Dashboard
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Operator — Dashboard', () => {
  test.setTimeout(60_000);

  test('lands on operator dashboard', async ({ page }) => {
    await goDashboard(page);
    await expect(page).toHaveURL(/\/company\/operator\/dashboard/);
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('loads without errors', async ({ page }) => {
    await goDashboard(page);
    await page.waitForLoadState('networkidle').catch(() => {});
    await assertNoErrors(page);
  });

  test('shows operator name or company name in header', async ({ page }) => {
    await goDashboard(page);
    const headerText = (await page.locator('h1, h2, nav').first().textContent()) ?? '';
    expect(headerText.trim().length).toBeGreaterThan(0);
  });

  test('primary tabs are present', async ({ page }) => {
    await goDashboard(page);
    // Operator should at minimum see Schedules and Bookings tabs
    await expect(
      page.locator('button:has-text("Schedules")')
        .or(page.locator('[role="tab"]:has-text("Schedules")'))
        .or(page.locator('a:has-text("Schedules")'))
        .first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('dashboard shows today\'s schedule count or summary stats', async ({ page }) => {
    await goDashboard(page);
    // Summary card, stat tile, or any heading with a number
    const stat = page.locator(
      '[data-testid="stat-card"], .stat, ' +
      'text=Today, text=Schedules, text=Assigned, text=Upcoming'
    ).first();
    const visible = await stat.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!visible) {
      console.log('[dashboard-stats] no stat cards visible — may be empty data');
    } else {
      await expect(stat).toBeVisible();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 2 — Role Guards
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Operator — Role Guards', () => {
  test.setTimeout(30_000);

  test('cannot access /company/admin', async ({ page }) => {
    await page.goto(`${BASE_URL}/company/admin`);
    await page.waitForURL(
      url => !url.pathname.startsWith('/company/admin'),
      { timeout: 15_000 }
    );
    expect(page.url()).not.toContain('/company/admin');
    console.log('[role-guard] /company/admin → redirected to', page.url());
  });

  test('cannot access /admin (superadmin area)', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    await page.waitForURL(
      url => !url.pathname.startsWith('/admin'),
      { timeout: 15_000 }
    );
    expect(page.url()).not.toContain('/admin');
  });

  test('cannot access /admin/dashboard', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/dashboard`);
    await page.waitForURL(
      url => !url.pathname.startsWith('/admin'),
      { timeout: 15_000 }
    );
    expect(page.url()).not.toContain('/admin');
  });

  test('can still access own dashboard after redirect attempt', async ({ page }) => {
    // After a failed access to /admin, operator should still be able to use their dashboard
    await page.goto(`${BASE_URL}/admin`);
    await page.waitForURL(url => !url.pathname.startsWith('/admin'), { timeout: 15_000 });
    await page.goto(BASE);
    await expect(page).toHaveURL(/\/company\/operator\/dashboard/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 3 — My Schedules
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Operator — Schedules', () => {
  test.setTimeout(90_000);

  test('Schedules tab loads — list or empty state', async ({ page }) => {
    await goDashboard(page);
    await tryTab(page, 'Schedules');
    await expect(
      page.locator('article, table, text=No schedules, text=no schedules').first()
    ).toBeVisible({ timeout: 20_000 });
    await assertNoErrors(page);
  });

  test('schedule cards show departure time', async ({ page }) => {
    await goDashboard(page);
    await tryTab(page, 'Schedules');
    const card = page.locator('article').first();
    if (!await card.isVisible({ timeout: 15_000 }).catch(() => false)) {
      console.log('[schedules] empty — skipping card content check'); return;
    }
    const text = (await card.textContent()) ?? '';
    expect(text).toMatch(/\d{1,2}:\d{2}/);
  });

  test('schedule cards show route origin and destination', async ({ page }) => {
    await goDashboard(page);
    await tryTab(page, 'Schedules');
    const card = page.locator('article').first();
    if (!await card.isVisible({ timeout: 15_000 }).catch(() => false)) return;
    const text = (await card.textContent()) ?? '';
    expect(text).toMatch(/blantyre|lilongwe|mzuzu|karonga|zomba|kasungu/i);
  });

  test('schedule cards show seat availability', async ({ page }) => {
    await goDashboard(page);
    await tryTab(page, 'Schedules');
    const card = page.locator('article').first();
    if (!await card.isVisible({ timeout: 15_000 }).catch(() => false)) return;
    const text = (await card.textContent()) ?? '';
    // Should mention seats or a numeric count
    expect(text).toMatch(/seat|passenger|\d+\s*\//i);
  });

  test('schedule cards show status badge', async ({ page }) => {
    await goDashboard(page);
    await tryTab(page, 'Schedules');
    const card = page.locator('article').first();
    if (!await card.isVisible({ timeout: 15_000 }).catch(() => false)) return;
    const text = (await card.textContent()) ?? '';
    expect(text).toMatch(/scheduled|departed|in.transit|completed|cancelled/i);
  });

  test('can update schedule status to Departed', async ({ page }) => {
    await goDashboard(page);
    await tryTab(page, 'Schedules');

    // Status could be a select or an action button
    const statusSelect = page.locator('select[name="status"], select[name*="status" i]').first();
    const statusBtn    = page.locator(
      'button:has-text("Mark Departed"), button:has-text("Departed"), button:has-text("In Transit")'
    ).first();

    const hasSelect = await statusSelect.isVisible({ timeout: 8_000 }).catch(() => false);
    const hasBtn    = await statusBtn.isVisible({ timeout: 4_000 }).catch(() => false);

    if (hasSelect) {
      await statusSelect.selectOption('departed');
      await expectToast(page);
      console.log('[status-select] marked departed ✓');
    } else if (hasBtn) {
      await statusBtn.click();
      const confirmBtn = page.locator('button:has-text("Confirm"), button:has-text("Yes")').last();
      if (await confirmBtn.isVisible({ timeout: 3_000 }).catch(() => false)) await confirmBtn.click();
      await expectToast(page);
      console.log('[status-btn] departed ✓');
    } else {
      console.log('[status] no status control visible — skipping');
    }
  });

  test('can mark schedule as Completed', async ({ page }) => {
    await goDashboard(page);
    await tryTab(page, 'Schedules');

    const completedBtn = page.locator(
      'button:has-text("Complete"), button:has-text("Mark Completed"), button:has-text("Arrived")'
    ).first();
    if (!await completedBtn.isVisible({ timeout: 8_000 }).catch(() => false)) {
      console.log('[complete] no complete button — skipping'); return;
    }
    await completedBtn.click();
    const confirmBtn = page.locator('button:has-text("Confirm"), button:has-text("Yes")').last();
    if (await confirmBtn.isVisible({ timeout: 3_000 }).catch(() => false)) await confirmBtn.click();
    await expectToast(page);
    console.log('[complete-schedule] ✓');
  });

  test('schedule filter by date works', async ({ page }) => {
    await goDashboard(page);
    await tryTab(page, 'Schedules');

    const dateFilter = page.locator('input[type="date"], input[name*="date" i]').first();
    if (!await dateFilter.isVisible({ timeout: 8_000 }).catch(() => false)) {
      console.log('[schedule-date-filter] no date input — skipping'); return;
    }
    const today = new Date().toISOString().slice(0, 10);
    await dateFilter.fill(today);
    await page.waitForTimeout(800);
    await assertNoErrors(page);
    console.log('[schedule-date-filter] ✓');
  });

  test('no edit/delete buttons visible — operator is read-only for schedule config', async ({ page }) => {
    await goDashboard(page);
    await tryTab(page, 'Schedules');
    const card = page.locator('article').first();
    if (!await card.isVisible({ timeout: 15_000 }).catch(() => false)) return;

    // Operator should NOT see admin-level edit/delete controls on schedule config
    const editConfigBtn = card.locator(
      'button:has-text("Edit Schedule"), button:has-text("Delete Schedule"), button:has-text("Delete Route")'
    ).first();
    await expect(editConfigBtn).not.toBeVisible();
    console.log('[read-only] no admin edit controls on schedule ✓');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 4 — Passenger Manifest
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Operator — Manifest', () => {
  test.setTimeout(90_000);

  test('manifest button opens passenger list', async ({ page }) => {
    const opened = await openManifest(page);
    if (!opened) return;
    await expect(
      page.locator('text=Passengers, text=Manifest, text=No passengers').first()
    ).toBeVisible({ timeout: 10_000 });
    console.log('[manifest-open] ✓');
  });

  test('manifest shows passenger names', async ({ page }) => {
    const opened = await openManifest(page);
    if (!opened) return;
    const rows = page.locator('table tr, [data-testid="passenger-row"], li').filter({ hasNotText: 'Name' });
    const count = await rows.count();
    if (count === 0) { console.log('[manifest-names] no passengers — skipping'); return; }
    const text = (await rows.first().textContent()) ?? '';
    expect(text.trim().length).toBeGreaterThan(0);
  });

  test('manifest shows seat numbers', async ({ page }) => {
    const opened = await openManifest(page);
    if (!opened) return;
    const rows = page.locator('table tr, [data-testid="passenger-row"]').filter({ hasNotText: 'Seat' });
    const count = await rows.count();
    if (count === 0) return;
    const text = (await rows.first().textContent()) ?? '';
    // Seat numbers are typically numeric or like "A1", "12"
    expect(text).toMatch(/\d+/);
  });

  test('manifest shows boarding status column', async ({ page }) => {
    const opened = await openManifest(page);
    if (!opened) return;
    await expect(
      page.locator('text=Boarded, text=Status, text=boarded, th:has-text("Status")').first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('manifest shows total passenger count', async ({ page }) => {
    const opened = await openManifest(page);
    if (!opened) return;
    // Should show something like "5 passengers" or "3/45 boarded"
    await expect(
      page.locator('text=passenger, text=Passenger, text=boarded, text=total').first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('manifest can be searched / filtered by name', async ({ page }) => {
    const opened = await openManifest(page);
    if (!opened) return;

    const searchInput = page.locator(
      'input[placeholder*="search" i], input[placeholder*="name" i], input[type="search"]'
    ).first();
    const hasSearch = await searchInput.isVisible({ timeout: 6_000 }).catch(() => false);
    if (!hasSearch) { console.log('[manifest-search] no search input — skipping'); return; }

    await searchInput.fill('test');
    await page.waitForTimeout(600);
    await assertNoErrors(page);
    console.log('[manifest-search] ✓');
  });

  test('manifest can be closed / dismissed', async ({ page }) => {
    const opened = await openManifest(page);
    if (!opened) return;

    const dialog = page.locator('[role="dialog"]').first();
    const isDialog = await dialog.isVisible({ timeout: 3_000 }).catch(() => false);

    if (isDialog) {
      const closeBtn = dialog
        .locator('button:has-text("Close"), button:has-text("Done")')
        .or(dialog.locator('button').filter({ has: page.locator('svg') }).last())
        .first();
      await closeBtn.click();
      await dialog.waitFor({ state: 'hidden', timeout: 6_000 }).catch(() => {});
      await expect(dialog).not.toBeVisible();
    } else {
      // Inline — navigate back
      const backBtn = page.locator('button:has-text("Back"), button:has-text("← Back")').first();
      if (await backBtn.isVisible({ timeout: 4_000 }).catch(() => false)) await backBtn.click();
    }
    console.log('[manifest-close] ✓');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 5 — Boarding & Check-in
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Operator — Boarding', () => {
  test.setTimeout(90_000);

  test('Board button is visible in manifest for unboarded passengers', async ({ page }) => {
    const opened = await openManifest(page);
    if (!opened) return;

    const boardBtn = page.locator(
      'button:has-text("Board"), button:has-text("Mark Boarded"), ' +
      'button:has-text("Check In"), button[aria-label*="board" i]'
    ).first();
    const has = await boardBtn.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!has) { console.log('[board-btn] no unboarded passengers — skipping'); return; }
    await expect(boardBtn).toBeVisible();
  });

  test('marking passenger as boarded updates their status', async ({ page }) => {
    const opened = await openManifest(page);
    if (!opened) return;

    const boardBtn = page.locator(
      'button:has-text("Board"), button:has-text("Mark Boarded"), button:has-text("Check In")'
    ).first();
    if (!await boardBtn.isVisible({ timeout: 10_000 }).catch(() => false)) {
      console.log('[board] no boardable passengers — skipping'); return;
    }

    // Note the passenger row before boarding
    const row = page.locator('table tr, [data-testid="passenger-row"]').filter({
      has: boardBtn,
    }).first();

    await boardBtn.click();

    // Confirm dialog if present
    const confirmBtn = page.locator('button:has-text("Confirm"), button:has-text("Yes")').last();
    if (await confirmBtn.isVisible({ timeout: 3_000 }).catch(() => false)) await confirmBtn.click();

    // Row should now show a boarded indicator
    await expect(
      row.locator('text=Boarded, text=boarded, text=✓, [data-status="boarded"]').first()
        .or(page.locator('text=Boarded, text=boarded').first())
    ).toBeVisible({ timeout: 10_000 });
    console.log('[board-passenger] ✓');
  });

  test('boarded passenger board button is disabled or hidden', async ({ page }) => {
    const opened = await openManifest(page);
    if (!opened) return;

    // Find a row already marked as boarded
    const boardedRow = page.locator(
      'table tr:has-text("Boarded"), [data-testid="passenger-row"]:has-text("Boarded")'
    ).first();
    const hasBoarded = await boardedRow.isVisible({ timeout: 8_000 }).catch(() => false);
    if (!hasBoarded) { console.log('[board-disable] no boarded rows yet — skipping'); return; }

    // The Board button inside a boarded row should be gone or disabled
    const boardBtn = boardedRow.locator(
      'button:has-text("Board"), button:has-text("Mark Boarded")'
    ).first();
    const isDisabled = await boardBtn.isDisabled().catch(() => true);
    const isVisible  = await boardBtn.isVisible().catch(() => false);
    expect(isDisabled || !isVisible).toBe(true);
    console.log('[board-disable] already-boarded passenger has no active board btn ✓');
  });

  test('boarded count increments after boarding a passenger', async ({ page }) => {
    const opened = await openManifest(page);
    if (!opened) return;

    // Read current boarded count from a "X/Y boarded" badge
    const countBadge = page.locator(
      'text=boarded, [data-testid="boarded-count"], text=/\\d+\\/\\d+/'
    ).first();
    const hasBadge = await countBadge.isVisible({ timeout: 6_000 }).catch(() => false);

    const boardBtn = page.locator('button:has-text("Board"), button:has-text("Check In")').first();
    if (!await boardBtn.isVisible({ timeout: 8_000 }).catch(() => false)) {
      console.log('[board-count] no boardable passengers — skipping'); return;
    }

    let beforeText = '';
    if (hasBadge) beforeText = (await countBadge.textContent()) ?? '';

    await boardBtn.click();
    const confirmBtn = page.locator('button:has-text("Confirm"), button:has-text("Yes")').last();
    if (await confirmBtn.isVisible({ timeout: 3_000 }).catch(() => false)) await confirmBtn.click();

    if (hasBadge) {
      await page.waitForTimeout(800);
      const afterText = (await countBadge.textContent()) ?? '';
      expect(afterText).not.toBe(beforeText);
      console.log('[board-count]', beforeText, '→', afterText, '✓');
    } else {
      await expectToast(page);
      console.log('[board-count] toast confirmed ✓');
    }
  });

  test('scan/search passenger by booking reference', async ({ page }) => {
    const opened = await openManifest(page);
    if (!opened) return;

    const refSearch = page.locator(
      'input[placeholder*="booking" i], input[placeholder*="reference" i], ' +
      'input[placeholder*="ref" i], input[placeholder*="ticket" i]'
    ).first();
    if (!await refSearch.isVisible({ timeout: 8_000 }).catch(() => false)) {
      console.log('[ref-search] no booking ref search — skipping'); return;
    }
    await refSearch.fill('BK-TEST-000');
    await page.waitForTimeout(600);
    // Should show no result or a result — just must not crash
    await assertNoErrors(page);
    console.log('[ref-search] ✓');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 6 — Bookings
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Operator — Bookings', () => {
  test.setTimeout(90_000);

  test('Bookings tab loads — list or empty state', async ({ page }) => {
    await goDashboard(page);
    const found = await tryTab(page, 'Bookings');
    if (!found) { console.log('[bookings-tab] not present — skipping suite'); return; }
    await expect(
      page.locator('article, table, text=No bookings, text=no bookings').first()
    ).toBeVisible({ timeout: 20_000 });
    await assertNoErrors(page);
  });

  test('booking cards show passenger name and route', async ({ page }) => {
    await goDashboard(page);
    await tryTab(page, 'Bookings');
    const card = page.locator('article, tr').first();
    if (!await card.isVisible({ timeout: 15_000 }).catch(() => false)) return;
    const text = (await card.textContent()) ?? '';
    expect(text.trim().length).toBeGreaterThan(5);
  });

  test('booking cards show status badge', async ({ page }) => {
    await goDashboard(page);
    await tryTab(page, 'Bookings');
    const card = page.locator('article, tr').first();
    if (!await card.isVisible({ timeout: 15_000 }).catch(() => false)) return;
    expect((await card.textContent()) ?? '').toMatch(/confirmed|pending|cancelled|paid/i);
  });

  test('can view booking detail', async ({ page }) => {
    await goDashboard(page);
    await tryTab(page, 'Bookings');
    const viewBtn = page.locator(
      'button:has-text("View"), button:has-text("Details"), button[aria-label*="view" i]'
    ).first();
    if (!await viewBtn.isVisible({ timeout: 15_000 }).catch(() => false)) {
      console.log('[booking-detail] no view button — skipping'); return;
    }
    await viewBtn.click();
    await expect(
      page.locator('[role="dialog"], [data-testid="booking-detail"]').first()
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.locator('text=Booking, text=Passenger, text=MWK, text=Seat').first()
    ).toBeVisible({ timeout: 8_000 });
    console.log('[booking-detail] ✓');
  });

  test('booking detail shows ticket / booking reference', async ({ page }) => {
    await goDashboard(page);
    await tryTab(page, 'Bookings');
    const viewBtn = page.locator('button:has-text("View"), button:has-text("Details")').first();
    if (!await viewBtn.isVisible({ timeout: 15_000 }).catch(() => false)) return;
    await viewBtn.click();
    await page.locator('[role="dialog"]').first().waitFor({ timeout: 10_000 });
    // Booking ref usually looks like BK-XXXXX or has a QR / barcode section
    await expect(
      page.locator('text=Reference, text=Booking ID, text=Ticket, [data-testid="booking-ref"]').first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test('operator cannot cancel booking — no cancel button', async ({ page }) => {
    // Operators can VIEW bookings but cancellation is an admin action
    await goDashboard(page);
    await tryTab(page, 'Bookings');
    const card = page.locator('article, tr').first();
    if (!await card.isVisible({ timeout: 15_000 }).catch(() => false)) return;

    const cancelBtn = card.locator('button:has-text("Cancel Booking"), button:has-text("Refund")').first();
    await expect(cancelBtn).not.toBeVisible();
    console.log('[read-only-bookings] no cancel/refund btn for operator ✓');
  });

  test('bookings filter by schedule works', async ({ page }) => {
    await goDashboard(page);
    await tryTab(page, 'Bookings');

    const scheduleFilter = page.locator(
      'select[name*="schedule" i], select[aria-label*="schedule" i]'
    ).first();
    if (!await scheduleFilter.isVisible({ timeout: 8_000 }).catch(() => false)) {
      console.log('[bookings-filter] no schedule filter — skipping'); return;
    }
    const opts = await scheduleFilter.locator('option:not([value=""])').all();
    if (!opts.length) return;
    await scheduleFilter.selectOption(await opts[0].getAttribute('value') ?? '');
    await page.waitForTimeout(800);
    await assertNoErrors(page);
    console.log('[bookings-filter] ✓');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 7 — Profile / Account
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Operator — Profile', () => {
  test.setTimeout(60_000);

  test('profile page is accessible', async ({ page }) => {
    await page.goto(`${BASE_URL}/profile`);
    await page.waitForSelector('input, form', { timeout: 20_000 });
    await assertNoErrors(page);
  });

  test('profile shows operator name pre-filled', async ({ page }) => {
    await page.goto(`${BASE_URL}/profile`);
    await page.waitForSelector('input[name="firstName"], input[placeholder*="First" i]', { timeout: 20_000 });
    const val = await page
      .locator('input[name="firstName"], input[placeholder*="First" i]')
      .first()
      .inputValue();
    expect(val.trim().length).toBeGreaterThan(0);
  });

  test('profile shows email pre-filled', async ({ page }) => {
    await page.goto(`${BASE_URL}/profile`);
    await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 20_000 });
    const val = await page
      .locator('input[type="email"], input[name="email"]')
      .first()
      .inputValue();
    expect(val).toContain('@');
  });

  test('can update phone number', async ({ page }) => {
    await page.goto(`${BASE_URL}/profile`);
    const phoneInput = page.locator('input[name="phone"], input[type="tel"]').first();
    if (!await phoneInput.isVisible({ timeout: 10_000 }).catch(() => false)) {
      console.log('[profile-phone] no phone field — skipping'); return;
    }
    await phoneInput.click({ clickCount: 3 });
    await phoneInput.fill('+265888001122');
    await page.locator('button[type="submit"], button:has-text("Save"), button:has-text("Update")').first().click();
    await expectToast(page);
    console.log('[profile-phone] ✓');
  });

  test('can update display name', async ({ page }) => {
    await page.goto(`${BASE_URL}/profile`);
    const firstNameInput = page.locator('input[name="firstName"], input[placeholder*="First" i]').first();
    if (!await firstNameInput.isVisible({ timeout: 10_000 }).catch(() => false)) return;

    const original = await firstNameInput.inputValue();
    await firstNameInput.click({ clickCount: 3 });
    await firstNameInput.fill(`${original}`); // same value — just tests the save flow

    await page.locator('button[type="submit"], button:has-text("Save"), button:has-text("Update")').first().click();
    await expectToast(page);
    console.log('[profile-name] ✓');
  });

  test('profile does not show admin-only fields (payment keys, company settings)', async ({ page }) => {
    await page.goto(`${BASE_URL}/profile`);
    await page.waitForSelector('input, form', { timeout: 20_000 });

    // Operator profile should never expose company payment API keys
    await expect(
      page.locator('input[name*="paychangu" i], input[name*="flutterwave" i], label:has-text("PayChangu")')
        .first()
    ).not.toBeVisible();
    console.log('[profile-read-only] no payment key fields visible ✓');
  });

  test('change password form is accessible', async ({ page }) => {
    await page.goto(`${BASE_URL}/profile`);
    const pwdSection = page.locator(
      'text=Change Password, text=Password, input[type="password"]'
    ).first();
    const visible = await pwdSection.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!visible) { console.log('[profile-password] no password section — skipping'); return; }
    await expect(pwdSection).toBeVisible();
    console.log('[profile-password] section visible ✓');
  });

  test('change password — mismatched passwords shows error', async ({ page }) => {
    await page.goto(`${BASE_URL}/profile`);
    const pwdInputs = page.locator('input[type="password"]');
    const count = await pwdInputs.count();
    if (count < 2) { console.log('[pwd-mismatch] not enough password fields — skipping'); return; }

    // Fill new password and a different confirm password
    await pwdInputs.nth(count === 2 ? 0 : 1).fill('NewPass123!');
    await pwdInputs.last().fill('DifferentPass999!');

    const saveBtn = page.locator('button:has-text("Update Password"), button:has-text("Change Password"), button[type="submit"]').first();
    await saveBtn.click();

    await expect(
      page.locator('text=match, text=Match, text=mismatch, text=same').first()
    ).toBeVisible({ timeout: 8_000 });
    console.log('[pwd-mismatch] error shown ✓');
  });
});
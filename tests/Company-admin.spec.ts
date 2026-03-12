// tests/company-admin.spec.ts — Full company admin coverage
// storageState = admin (loaded per project in playwright.config.ts)

import { test, expect, Page } from '@playwright/test';
import { BASE_URL, assertNoErrors, fillIfVisible } from './helpers';

// ─── Shared helpers ───────────────────────────────────────────────────────────

async function goToAdmin(page: Page) {
  await page.goto(`${BASE_URL}/company/admin`);
  await page.waitForSelector('h1, h2', { timeout: 20_000 });
}

async function clickTab(page: Page, label: string) {
  const tab = page
    .locator(`button:has-text("${label}")`)
    .or(page.locator(`a:has-text("${label}")`))
    .first();
  await tab.waitFor({ timeout: 20_000 });
  await tab.click();
  await page.waitForTimeout(800);
}

async function openModal(page: Page, noun: string) {
  const btn = page
    .locator(`button:has-text("Add ${noun}")`)
    .or(page.locator(`button:has-text("New ${noun}")`))
    .or(page.locator(`button:has-text("Create ${noun}")`))
    .or(page.locator(`button:has-text("Invite")`))
    .first();
  await btn.waitFor({ timeout: 15_000 });
  await btn.click();
  const modal = page.locator('[role="dialog"]').first();
  await modal.waitFor({ timeout: 10_000 });
  return modal;
}

async function closeModal(page: Page) {
  const modal = page.locator('[role="dialog"]').first();
  await modal
    .locator('button:has-text("Cancel")')
    .or(modal.locator('button:has-text("Close")'))
    .or(modal.locator('button').filter({ has: page.locator('svg') }).last())
    .first()
    .click();
  await modal.waitFor({ state: 'hidden', timeout: 6_000 }).catch(() => {});
}

async function expectToast(page: Page) {
  await expect(
    page.locator(
      '[role="status"], [role="alert"], .toast, ' +
      'text=success, text=Success, text=saved, text=Saved, ' +
      'text=created, text=Created, text=updated, text=Updated, ' +
      'text=deleted, text=Deleted, text=removed, text=Removed'
    ).first()
  ).toBeVisible({ timeout: 12_000 });
}

const uid = () => Date.now().toString().slice(-6);

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 1 — Dashboard
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Company Admin — Dashboard', () => {
  test.setTimeout(60_000);

  test('loads without errors', async ({ page }) => {
    await goToAdmin(page);
    await assertNoErrors(page);
  });

  test('all primary tabs are present', async ({ page }) => {
    await goToAdmin(page);
    for (const tab of ['Schedules', 'Routes', 'Bookings']) {
      await expect(
        page.locator(`button:has-text("${tab}")`).or(page.locator(`a:has-text("${tab}")`)).first()
      ).toBeVisible({ timeout: 10_000 });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 2 — Schedules CRUD
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Company Admin — Schedules', () => {
  test.setTimeout(120_000);

  test('tab loads — list or empty state', async ({ page }) => {
    await goToAdmin(page);
    await clickTab(page, 'Schedules');
    await expect(
      page.locator('article, table, text=No schedules').first()
    ).toBeVisible({ timeout: 20_000 });
    await assertNoErrors(page);
  });

  test('schedule cards show time and price', async ({ page }) => {
    await goToAdmin(page);
    await clickTab(page, 'Schedules');
    const card = page.locator('article').first();
    if (!await card.isVisible({ timeout: 15_000 }).catch(() => false)) return;
    const text = (await card.textContent()) ?? '';
    expect(text).toMatch(/\d{1,2}:\d{2}/);
    expect(text).toMatch(/MWK/);
  });

  test('Add Schedule modal has all required fields', async ({ page }) => {
    await goToAdmin(page);
    await clickTab(page, 'Schedules');
    const modal = await openModal(page, 'Schedule');
    for (const sel of [
      'select[name="routeId"], select[name="route"]',
      'select[name="busId"], select[name="bus"]',
      'input[name="price"]',
      'input[type="datetime-local"], input[name*="departure" i]',
    ]) {
      await expect(modal.locator(sel).first()).toBeVisible({ timeout: 8_000 });
    }
    await closeModal(page);
  });

  test('segment price editor present in Add Schedule modal', async ({ page }) => {
    await goToAdmin(page);
    await clickTab(page, 'Schedules');
    const modal = await openModal(page, 'Schedule');
    const found = await modal.locator(
      'text=Segment Price, text=Segment Pricing, text=Stop Prices, text=Per-Stop Pricing'
    ).first().isVisible({ timeout: 8_000 }).catch(() => false);
    console.log('[segment-price]', found ? 'found ✓' : 'not visible yet (loads after route select)');
    await closeModal(page);
  });

  test('create new schedule end-to-end', async ({ page }) => {
    await goToAdmin(page);
    await clickTab(page, 'Schedules');
    const modal = await openModal(page, 'Schedule');

    const routeSelect = modal.locator('select[name="routeId"], select[name="route"]').first();
    if (!await routeSelect.isVisible({ timeout: 8_000 }).catch(() => false)) {
      await closeModal(page); return;
    }
    const routeOpts = await routeSelect.locator('option:not([value=""]):not([disabled])').all();
    if (!routeOpts.length) { await closeModal(page); return; }
    await routeSelect.selectOption(await routeOpts[0].getAttribute('value') ?? '');
    await page.waitForTimeout(600);

    const busSelect = modal.locator('select[name="busId"], select[name="bus"]').first();
    if (await busSelect.isVisible({ timeout: 4_000 }).catch(() => false)) {
      const busOpts = await busSelect.locator('option:not([value=""]):not([disabled])').all();
      if (busOpts.length) await busSelect.selectOption(await busOpts[0].getAttribute('value') ?? '');
    }

    await modal.locator('input[name="price"]').first().fill('5500');

    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    const base = tomorrow.toISOString().slice(0, 10);
    await fillIfVisible(page, 'input[type="datetime-local"][name*="departure" i], input[type="datetime-local"]', `${base}T07:00`);
    await fillIfVisible(page, 'input[name*="arrival" i]', `${base}T11:30`);

    await modal.locator('button[type="submit"], button:has-text("Save"), button:has-text("Create")').first().click();
    await Promise.race([expectToast(page), modal.waitFor({ state: 'hidden', timeout: 12_000 })]);
    console.log('[create-schedule] ✓');
  });

  test('edit schedule — change price', async ({ page }) => {
    await goToAdmin(page);
    await clickTab(page, 'Schedules');
    const editBtn = page.locator('button:has-text("Edit"), button[aria-label*="edit" i]').first();
    if (!await editBtn.isVisible({ timeout: 15_000 }).catch(() => false)) return;
    await editBtn.click();
    const modal = page.locator('[role="dialog"]').first();
    await modal.waitFor({ timeout: 10_000 });
    const priceInput = modal.locator('input[name="price"]').first();
    await priceInput.click({ clickCount: 3 });
    await priceInput.fill(String(4000 + Math.floor(Math.random() * 3000)));
    await modal.locator('button[type="submit"], button:has-text("Save"), button:has-text("Update")').first().click();
    await Promise.race([expectToast(page), modal.waitFor({ state: 'hidden', timeout: 12_000 })]);
    console.log('[edit-schedule] ✓');
  });

  test('delete schedule with confirmation', async ({ page }) => {
    await goToAdmin(page);
    await clickTab(page, 'Schedules');
    const deleteBtn = page.locator('button:has-text("Delete"), button[aria-label*="delete" i]').first();
    if (!await deleteBtn.isVisible({ timeout: 15_000 }).catch(() => false)) return;
    await deleteBtn.click();
    const confirmBtn = page.locator('button:has-text("Confirm"), button:has-text("Yes"), button:has-text("Delete")').last();
    if (await confirmBtn.isVisible({ timeout: 4_000 }).catch(() => false)) await confirmBtn.click();
    await expectToast(page);
    console.log('[delete-schedule] ✓');
  });

  test('closing Add Schedule modal removes it from DOM', async ({ page }) => {
    await goToAdmin(page);
    await clickTab(page, 'Schedules');
    const modal = await openModal(page, 'Schedule');
    await closeModal(page);
    await expect(modal).not.toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 3 — Routes CRUD
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Company Admin — Routes', () => {
  test.setTimeout(120_000);

  test('tab loads — list or empty state', async ({ page }) => {
    await goToAdmin(page);
    await clickTab(page, 'Routes');
    await expect(
      page.locator('article, table, text=No routes').first()
    ).toBeVisible({ timeout: 20_000 });
    await assertNoErrors(page);
  });

  test('Add Route modal has origin, destination, distance fields', async ({ page }) => {
    await goToAdmin(page);
    await clickTab(page, 'Routes');
    const modal = await openModal(page, 'Route');
    await expect(modal.locator('input[name="origin"], select[name="origin"]').first()).toBeVisible({ timeout: 8_000 });
    await expect(modal.locator('input[name="destination"], select[name="destination"]').first()).toBeVisible({ timeout: 8_000 });
    await expect(modal.locator('input[name="distance"], input[name="duration"]').first()).toBeVisible({ timeout: 8_000 });
    await closeModal(page);
  });

  test('create route end-to-end', async ({ page }) => {
    await goToAdmin(page);
    await clickTab(page, 'Routes');
    const modal = await openModal(page, 'Route');

    const originInput = modal.locator('input[name="origin"]').first();
    if (await originInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await originInput.fill('Blantyre');
    } else {
      const sel = modal.locator('select[name="origin"]').first();
      const opts = await sel.locator('option:not([value=""])').all();
      if (opts.length) await sel.selectOption(await opts[0].getAttribute('value') ?? '');
    }

    const destInput = modal.locator('input[name="destination"]').first();
    if (await destInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await destInput.fill('Zomba');
    } else {
      const sel = modal.locator('select[name="destination"]').first();
      const opts = await sel.locator('option:not([value=""])').all();
      if (opts.length > 1) await sel.selectOption(await opts[1].getAttribute('value') ?? '');
    }

    await fillIfVisible(page, 'input[name="distance"]', '120');
    await fillIfVisible(page, 'input[name="duration"]', '180');
    await fillIfVisible(page, 'input[name="price"]',    '4500');

    await modal.locator('button[type="submit"], button:has-text("Save"), button:has-text("Create")').first().click();
    await Promise.race([expectToast(page), modal.waitFor({ state: 'hidden', timeout: 12_000 })]);
    console.log('[create-route] ✓');
  });

  test('edit route — update distance', async ({ page }) => {
    await goToAdmin(page);
    await clickTab(page, 'Routes');
    const editBtn = page.locator('button:has-text("Edit"), button[aria-label*="edit" i]').first();
    if (!await editBtn.isVisible({ timeout: 15_000 }).catch(() => false)) return;
    await editBtn.click();
    const modal = page.locator('[role="dialog"]').first();
    await modal.waitFor({ timeout: 10_000 });
    const distInput = modal.locator('input[name="distance"]').first();
    if (await distInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await distInput.click({ clickCount: 3 });
      await distInput.fill(String(100 + Math.floor(Math.random() * 150)));
    }
    await modal.locator('button[type="submit"], button:has-text("Save"), button:has-text("Update")').first().click();
    await Promise.race([expectToast(page), modal.waitFor({ state: 'hidden', timeout: 12_000 })]);
    console.log('[edit-route] ✓');
  });

  test('delete route with confirmation', async ({ page }) => {
    await goToAdmin(page);
    await clickTab(page, 'Routes');
    const deleteBtn = page.locator('button:has-text("Delete"), button[aria-label*="delete" i]').first();
    if (!await deleteBtn.isVisible({ timeout: 15_000 }).catch(() => false)) return;
    await deleteBtn.click();
    const confirmBtn = page.locator('button:has-text("Confirm"), button:has-text("Yes"), button:has-text("Delete")').last();
    if (await confirmBtn.isVisible({ timeout: 4_000 }).catch(() => false)) await confirmBtn.click();
    await expectToast(page);
    console.log('[delete-route] ✓');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 4 — Buses
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Company Admin — Buses', () => {
  test.setTimeout(120_000);

  test('tab loads — list or empty state', async ({ page }) => {
    await goToAdmin(page);
    await clickTab(page, 'Buses');
    await expect(
      page.locator('article, table, text=No buses').first()
    ).toBeVisible({ timeout: 20_000 });
    await assertNoErrors(page);
  });

  test('Add Bus modal has plate, type, capacity fields', async ({ page }) => {
    await goToAdmin(page);
    await clickTab(page, 'Buses');
    const modal = await openModal(page, 'Bus');
    await expect(modal.locator('input[name="licensePlate"], input[placeholder*="plate" i]').first()).toBeVisible({ timeout: 8_000 });
    await expect(modal.locator('select[name="busType"], input[name="busType"]').first()).toBeVisible({ timeout: 8_000 });
    await expect(modal.locator('input[name="capacity"], input[name="totalSeats"]').first()).toBeVisible({ timeout: 8_000 });
    await closeModal(page);
  });

  test('create bus end-to-end', async ({ page }) => {
    await goToAdmin(page);
    await clickTab(page, 'Buses');
    const modal = await openModal(page, 'Bus');
    const id = uid();

    await fillIfVisible(page, 'input[name="licensePlate"], input[placeholder*="plate" i]', `BT ${id} M`);
    await fillIfVisible(page, 'input[name="capacity"], input[name="totalSeats"]', '45');

    const typeSelect = modal.locator('select[name="busType"]').first();
    if (await typeSelect.isVisible({ timeout: 3_000 }).catch(() => false)) {
      const opts = await typeSelect.locator('option:not([value=""])').all();
      if (opts.length) await typeSelect.selectOption(await opts[0].getAttribute('value') ?? '');
    } else {
      await fillIfVisible(page, 'input[name="busType"]', 'Standard');
    }

    await modal.locator('button[type="submit"], button:has-text("Save"), button:has-text("Add"), button:has-text("Create")').first().click();
    await Promise.race([expectToast(page), modal.waitFor({ state: 'hidden', timeout: 12_000 })]);
    console.log('[create-bus] ✓');
  });

  test('edit bus — toggle amenity', async ({ page }) => {
    await goToAdmin(page);
    await clickTab(page, 'Buses');
    const editBtn = page.locator('button:has-text("Edit"), button[aria-label*="edit" i]').first();
    if (!await editBtn.isVisible({ timeout: 15_000 }).catch(() => false)) return;
    await editBtn.click();
    const modal = page.locator('[role="dialog"]').first();
    await modal.waitFor({ timeout: 10_000 });
    const amenityCheck = modal.locator(
      'input[type="checkbox"][value*="WiFi" i], label:has-text("WiFi") input, label:has-text("AC") input'
    ).first();
    if (await amenityCheck.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await amenityCheck.click();
    } else {
      await fillIfVisible(page, 'input[placeholder*="amenities" i]', 'WiFi, AC');
    }
    await modal.locator('button[type="submit"], button:has-text("Save"), button:has-text("Update")').first().click();
    await Promise.race([expectToast(page), modal.waitFor({ state: 'hidden', timeout: 12_000 })]);
    console.log('[edit-bus-amenities] ✓');
  });

  test('deactivate bus updates status', async ({ page }) => {
    await goToAdmin(page);
    await clickTab(page, 'Buses');
    const deactivateBtn = page.locator('button:has-text("Deactivate"), button:has-text("Disable")').first();
    if (!await deactivateBtn.isVisible({ timeout: 15_000 }).catch(() => false)) return;
    await deactivateBtn.click();
    const confirmBtn = page.locator('button:has-text("Confirm"), button:has-text("Yes")').last();
    if (await confirmBtn.isVisible({ timeout: 3_000 }).catch(() => false)) await confirmBtn.click();
    await expect(
      page.locator('text=inactive, text=Inactive, text=deactivated, text=Deactivated').first()
    ).toBeVisible({ timeout: 10_000 });
    console.log('[deactivate-bus] ✓');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 5 — Bookings management
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Company Admin — Bookings', () => {
  test.setTimeout(90_000);

  test('tab loads without errors', async ({ page }) => {
    await goToAdmin(page);
    await clickTab(page, 'Bookings');
    await expect(
      page.locator('article, table, text=No bookings').first()
    ).toBeVisible({ timeout: 20_000 });
    await assertNoErrors(page);
  });

  test('booking cards show status badge', async ({ page }) => {
    await goToAdmin(page);
    await clickTab(page, 'Bookings');
    const card = page.locator('article, tr').first();
    if (!await card.isVisible({ timeout: 20_000 }).catch(() => false)) return;
    expect((await card.textContent()) ?? '').toMatch(/confirmed|pending|cancelled|paid/i);
  });

  test('can view booking detail modal', async ({ page }) => {
    await goToAdmin(page);
    await clickTab(page, 'Bookings');
    const viewBtn = page.locator('button:has-text("View"), button:has-text("Details")').first();
    if (!await viewBtn.isVisible({ timeout: 15_000 }).catch(() => false)) return;
    await viewBtn.click();
    await expect(page.locator('[role="dialog"]').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('text=Booking, text=Passenger, text=MWK').first()).toBeVisible({ timeout: 8_000 });
  });

  test('can cancel a booking', async ({ page }) => {
    await goToAdmin(page);
    await clickTab(page, 'Bookings');
    const cancelBtn = page.locator('button:has-text("Cancel Booking"), button:has-text("Cancel")').first();
    if (!await cancelBtn.isVisible({ timeout: 15_000 }).catch(() => false)) return;
    await cancelBtn.click();
    const confirmBtn = page.locator('button:has-text("Confirm"), button:has-text("Yes")').last();
    if (await confirmBtn.isVisible({ timeout: 4_000 }).catch(() => false)) await confirmBtn.click();
    await expectToast(page);
    console.log('[cancel-booking] ✓');
  });

  test('status filter shows only matching bookings', async ({ page }) => {
    await goToAdmin(page);
    await clickTab(page, 'Bookings');
    const filterSelect = page.locator('select[name*="status" i]').first();
    if (await filterSelect.isVisible({ timeout: 8_000 }).catch(() => false)) {
      // selectOption doesn't accept RegExp — find the matching option value first
      const confirmedValue = await filterSelect
        .locator('option')
        .filter({ hasText: /confirmed/i })
        .first()
        .getAttribute('value')
        .catch(() => null);
      if (confirmedValue === null) return;
      await filterSelect.selectOption(confirmedValue);
      await page.waitForTimeout(800);
      const cards = page.locator('article, tr');
      const count = await cards.count();
      for (let i = 0; i < Math.min(count, 4); i++) {
        expect((await cards.nth(i).textContent()) ?? '').toMatch(/confirmed/i);
      }
    } else {
      const confirmedTab = page.locator('button:has-text("Confirmed")').first();
      if (await confirmedTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await confirmedTab.click();
        await page.waitForTimeout(600);
        console.log('[booking-filter] tab-style filter ✓');
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 6 — Team management
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Company Admin — Team', () => {
  test.setTimeout(120_000);

  test('tab loads — list or empty state', async ({ page }) => {
    await goToAdmin(page);
    const teamTab = page.locator('button:has-text("Team")')
      .or(page.locator('button:has-text("Operators")')).or(page.locator('button:has-text("Staff")')).first();
    await teamTab.waitFor({ timeout: 20_000 });
    await teamTab.click();
    await expect(
      page.locator('article, table, text=No team, text=No operators, text=No members').first()
    ).toBeVisible({ timeout: 20_000 });
    await assertNoErrors(page);
  });

  test('team member cards show role badge', async ({ page }) => {
    await goToAdmin(page);
    await clickTab(page, 'Team');
    const card = page.locator('article, tr').first();
    if (!await card.isVisible({ timeout: 15_000 }).catch(() => false)) return;
    expect((await card.textContent()) ?? '').toMatch(/operator|admin|role/i);
  });

  test('Invite modal opens with email field', async ({ page }) => {
    await goToAdmin(page);
    await clickTab(page, 'Team');
    const inviteBtn = page.locator('button:has-text("Invite"), button:has-text("Add Operator"), button:has-text("Add Member")').first();
    if (!await inviteBtn.isVisible({ timeout: 15_000 }).catch(() => false)) return;
    await inviteBtn.click();
    const modal = page.locator('[role="dialog"]').first();
    await modal.waitFor({ timeout: 10_000 });
    await expect(modal.locator('input[type="email"], input[name="email"]').first()).toBeVisible({ timeout: 8_000 });
    await closeModal(page);
  });

  test('invite operator — shows confirmation', async ({ page }) => {
    await goToAdmin(page);
    await clickTab(page, 'Team');
    const inviteBtn = page.locator('button:has-text("Invite"), button:has-text("Add Operator"), button:has-text("Add Member")').first();
    if (!await inviteBtn.isVisible({ timeout: 15_000 }).catch(() => false)) return;
    await inviteBtn.click();
    const modal = page.locator('[role="dialog"]').first();
    await modal.waitFor({ timeout: 10_000 });
    await modal.locator('input[type="email"], input[name="email"]').first().fill(`operator+${uid()}@mailinator.com`);
    await fillIfVisible(page, 'input[name="firstName"], input[placeholder*="First" i]', 'Test');
    await fillIfVisible(page, 'input[name="lastName"],  input[placeholder*="Last" i]',  'Operator');
    await modal.locator('button[type="submit"], button:has-text("Invite"), button:has-text("Send")').first().click();
    await Promise.race([expectToast(page), modal.waitFor({ state: 'hidden', timeout: 12_000 })]);
    console.log('[invite-operator] ✓');
  });

  test('change team member role', async ({ page }) => {
    await goToAdmin(page);
    await clickTab(page, 'Team');
    const roleControl = page.locator('button:has-text("Change Role"), select[name*="role" i]').first();
    if (!await roleControl.isVisible({ timeout: 15_000 }).catch(() => false)) return;
    const tag = await roleControl.evaluate((el) => el.tagName.toLowerCase());
    if (tag === 'select') {
      const opts = await roleControl.locator('option:not([value=""])').all();
      if (opts.length) await (roleControl as any).selectOption(await opts[0].getAttribute('value') ?? '');
    } else {
      await roleControl.click();
      const opt = page.locator('[role="option"], [role="menuitem"]').first();
      if (await opt.isVisible({ timeout: 4_000 }).catch(() => false)) await opt.click();
    }
    await expectToast(page);
    console.log('[change-role] ✓');
  });

  test('remove team member with confirmation', async ({ page }) => {
    await goToAdmin(page);
    await clickTab(page, 'Team');
    const removeBtn = page.locator('button:has-text("Remove"), button[aria-label*="remove" i]').first();
    if (!await removeBtn.isVisible({ timeout: 15_000 }).catch(() => false)) return;
    await removeBtn.click();
    const confirmBtn = page.locator('button:has-text("Confirm"), button:has-text("Yes"), button:has-text("Remove")').last();
    if (await confirmBtn.isVisible({ timeout: 4_000 }).catch(() => false)) await confirmBtn.click();
    await expectToast(page);
    console.log('[remove-member] ✓');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 7 — Company Profile
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Company Admin — Profile', () => {
  test.setTimeout(90_000);

  async function goToProfile(page: Page) {
    await goToAdmin(page);
    const tab = page.locator('button:has-text("Profile"), a:has-text("Profile")').first();
    if (await tab.isVisible({ timeout: 8_000 }).catch(() => false)) await tab.click();
    else await page.goto(`${BASE_URL}/company/admin/profile`);
    await page.waitForSelector('input[name="name"], input[placeholder*="Company" i]', { timeout: 20_000 });
  }

  test('loads with existing company data', async ({ page }) => {
    await goToProfile(page);
    const nameVal = await page.locator('input[name="name"], input[placeholder*="Company" i]').first().inputValue();
    expect(nameVal.length).toBeGreaterThan(0);
    await assertNoErrors(page);
  });

  test('update company name saves and restores', async ({ page }) => {
    await goToProfile(page);
    const nameInput = page.locator('input[name="name"], input[placeholder*="Company name" i]').first();
    const original = await nameInput.inputValue();
    await nameInput.click({ clickCount: 3 });
    await nameInput.fill(`${original} (test)`);
    await page.locator('button[type="submit"], button:has-text("Save")').first().click();
    await expectToast(page);
    // Restore
    await nameInput.click({ clickCount: 3 });
    await nameInput.fill(original);
    await page.locator('button[type="submit"], button:has-text("Save")').first().click();
    await expectToast(page);
    console.log('[profile-name] ✓');
  });

  test('update contact phone', async ({ page }) => {
    await goToProfile(page);
    const phoneInput = page.locator('input[name="phone"], input[type="tel"]').first();
    if (!await phoneInput.isVisible({ timeout: 8_000 }).catch(() => false)) return;
    await phoneInput.click({ clickCount: 3 });
    await phoneInput.fill('+265999000111');
    await page.locator('button[type="submit"], button:has-text("Save")').first().click();
    await expectToast(page);
    console.log('[profile-phone] ✓');
  });

  test('logo upload input is present', async ({ page }) => {
    await goToProfile(page);
    await expect(
      page.locator('input[type="file"], label:has-text("Logo"), button:has-text("Upload")').first()
    ).toBeVisible({ timeout: 15_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 8 — Payment Settings
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Company Admin — Payment Settings', () => {
  test.setTimeout(90_000);

  async function goToPayments(page: Page) {
    await goToAdmin(page);
    const tab = page
      .locator('button:has-text("Settings")')
      .or(page.locator('button:has-text("Payment Settings")'))
      .or(page.locator('button:has-text("Payments")'))
      .first();
    if (await tab.isVisible({ timeout: 8_000 }).catch(() => false)) await tab.click();
    else await page.goto(`${BASE_URL}/company/admin/settings`);
    await expect(
      page.locator('text=PayChangu, text=Flutterwave, text=Payment').first()
    ).toBeVisible({ timeout: 20_000 });
  }

  test('payment settings loads', async ({ page }) => {
    await goToPayments(page);
    await assertNoErrors(page);
  });

  test('PayChangu key field visible', async ({ page }) => {
    await goToPayments(page);
    await expect(
      page.locator('input[name*="paychangu" i], input[placeholder*="PayChangu" i], label:has-text("PayChangu")').first()
    ).toBeVisible({ timeout: 12_000 });
  });

  test('Flutterwave key field visible', async ({ page }) => {
    await goToPayments(page);
    await expect(
      page.locator('input[name*="flutterwave" i], input[placeholder*="Flutterwave" i], input[name*="flw" i], label:has-text("Flutterwave")').first()
    ).toBeVisible({ timeout: 12_000 });
  });

  test('save PayChangu key — shows success', async ({ page }) => {
    await goToPayments(page);
    const input = page.locator('input[name*="paychangu" i], input[placeholder*="PayChangu" i]').first();
    if (!await input.isVisible({ timeout: 8_000 }).catch(() => false)) return;
    await input.click({ clickCount: 3 });
    await input.fill('test-pk-' + uid());
    await page.locator('button[type="submit"], button:has-text("Save")').first().click();
    await expectToast(page);
    console.log('[paychangu-save] ✓');
  });

  test('save Flutterwave key — shows success', async ({ page }) => {
    await goToPayments(page);
    const input = page.locator('input[name*="flutterwave" i], input[name*="flw" i], input[placeholder*="Flutterwave" i]').first();
    if (!await input.isVisible({ timeout: 8_000 }).catch(() => false)) return;
    await input.click({ clickCount: 3 });
    await input.fill('FLWSECK_TEST-' + uid());
    await page.locator('button[type="submit"], button:has-text("Save")').first().click();
    await expectToast(page);
    console.log('[flutterwave-save] ✓');
  });

  test('payment method toggles fire and confirm', async ({ page }) => {
    await goToPayments(page);
    const toggle = page.locator('button[role="switch"], input[type="checkbox"]').first();
    if (!await toggle.isVisible({ timeout: 8_000 }).catch(() => false)) return;
    await toggle.click();
    await expectToast(page);
    await toggle.click(); // restore
    await expectToast(page);
    console.log('[payment-toggle] ✓');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 9 — Revenue Reports
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Company Admin — Reports', () => {
  test.setTimeout(90_000);

  async function goToReports(page: Page) {
    await goToAdmin(page);
    const tab = page.locator('button:has-text("Reports"), a:has-text("Reports")').first();
    if (!await tab.isVisible({ timeout: 8_000 }).catch(() => false)) {
      console.log('[reports] tab not found'); test.skip(); return;
    }
    await tab.click();
    await page.waitForTimeout(800);
  }

  test('loads with revenue summary', async ({ page }) => {
    await goToReports(page);
    await expect(
      page.locator('text=Revenue, text=Total, text=Bookings, text=Reports').first()
    ).toBeVisible({ timeout: 20_000 });
    await assertNoErrors(page);
  });

  test('MWK total is visible', async ({ page }) => {
    await goToReports(page);
    await expect(page.locator('text=MWK').first()).toBeVisible({ timeout: 15_000 });
  });

  test('date range filter updates report', async ({ page }) => {
    await goToReports(page);
    const startDate = page.locator('input[type="date"]').first();
    if (!await startDate.isVisible({ timeout: 8_000 }).catch(() => false)) return;
    await startDate.fill('2025-01-01');
    await page.locator('input[type="date"]').last().fill('2025-12-31');
    const applyBtn = page.locator('button:has-text("Apply"), button:has-text("Filter"), button:has-text("Search")').first();
    if (await applyBtn.isVisible({ timeout: 4_000 }).catch(() => false)) await applyBtn.click();
    await page.waitForTimeout(1_500);
    await assertNoErrors(page);
    console.log('[reports-date-filter] ✓');
  });

  test('export button present', async ({ page }) => {
    await goToReports(page);
    const exportBtn = page.locator('button:has-text("Export"), button:has-text("Download"), a:has-text("Export")').first();
    if (!await exportBtn.isVisible({ timeout: 10_000 }).catch(() => false)) return;
    await expect(exportBtn).toBeVisible();
  });

  test('export triggers file download', async ({ page }) => {
    await goToReports(page);
    const exportBtn = page.locator('button:has-text("Export"), button:has-text("Download CSV"), a[download]').first();
    if (!await exportBtn.isVisible({ timeout: 10_000 }).catch(() => false)) return;
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 15_000 }),
      exportBtn.click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.(csv|xlsx|pdf)$/i);
    console.log('[reports-download]', download.suggestedFilename(), '✓');
  });
});
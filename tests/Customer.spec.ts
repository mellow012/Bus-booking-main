// tests/customer.spec.ts — Full customer journey
import { test, expect, Page } from '@playwright/test';
import { BASE_URL, login, dismissCityPicker } from './helpers';

test.describe('Customer Journey', () => {
  test.setTimeout(180_000);

  // ── Search ──────────────────────────────────────────────────────────────────

  test('search results match origin + destination', async ({ page }) => {
    await login(page, 'customer');
    await dismissCityPicker(page);
    await page.goto(`${BASE_URL}/`);
    await page.waitForSelector('#search-from', { timeout: 30_000 });

    await page.fill('#search-from', 'Mzuzu');
    await page.locator('[role="option"]:has-text("Mzuzu")').first().click().catch(async () => {
      // autocomplete may not show for exact match — that's fine
    });
    await page.fill('#search-to', 'Karonga');
    await page.locator('[role="option"]:has-text("Karonga")').first().click().catch(() => {});

    await Promise.all([
      page.waitForURL(url => url.pathname === '/search', { timeout: 30_000 }),
      page.click('button:has-text("Search Buses")'),
    ]);

    const cards = page.locator('article');
    await cards.first().waitFor({ timeout: 60_000 });
    const count = await cards.count();
    console.log(`[search] ${count} results`);

    // Every result must mention Mzuzu or Karonga
    for (let i = 0; i < Math.min(count, 5); i++) {
      const text = (await cards.nth(i).textContent())?.toLowerCase() ?? '';
      expect(text).toMatch(/mzuzu|karonga/);
    }
  });

  test('empty search shows all routes', async ({ page }) => {
    await login(page, 'customer');
    await page.goto(`${BASE_URL}/search`);
    const cards = page.locator('article');
    await cards.first().waitFor({ timeout: 30_000 });
    expect(await cards.count()).toBeGreaterThan(0);
  });

  // ── Profile ─────────────────────────────────────────────────────────────────

  test('profile page loads with user data', async ({ page }) => {
    await login(page, 'customer');
    await page.goto(`${BASE_URL}/profile`);
    await page.waitForSelector('input[name="firstName"], input[placeholder*="First"]', { timeout: 20_000 });
    const val = await page.inputValue('input[name="firstName"], input[placeholder*="First"]');
    expect(val.length).toBeGreaterThan(0);
  });

  // ── Full booking flow ───────────────────────────────────────────────────────

  test('full booking → PayChangu sandbox', async ({ page }) => {
    await login(page, 'customer');
    await dismissCityPicker(page);

    // Search
    await page.goto(`${BASE_URL}/`);
    await page.waitForSelector('#search-from', { timeout: 30_000 });
    await page.fill('#search-from', 'Mzuzu');
    await page.fill('#search-to',   'Karonga');
    await Promise.all([
      page.waitForURL(url => url.pathname === '/search', { timeout: 30_000 }),
      page.click('button:has-text("Search Buses")'),
    ]);

    // Click first book button
    const bookBtn = page.locator(
      'button:has-text("Book Journey"), button:has-text("Book Now"), button:has-text("Book")'
    ).first();
    await bookBtn.waitFor({ timeout: 60_000 });
    await Promise.all([
      page.waitForURL(/\/book\//, { timeout: 30_000 }),
      bookBtn.click(),
    ]);
    console.log('[booking] on', page.url());

    // Select stops
    await selectStops(page);

    // Select seat
    await selectFirstAvailableSeat(page);

    // Continue
    await page.locator(
      'button:has-text("Continue"), button:has-text("Reserve"), button:has-text("Proceed")'
    ).first().click();

    // Passenger details
    await fillPassengerForm(page);

    // Continue to review
    await page.locator(
      'button:has-text("Continue to Review"), button:has-text("Proceed"), button:has-text("Review")'
    ).first().click();

    // Confirm & pay
    const payBtn = page.locator('button:has-text("Pay"), button:has-text("Confirm & Pay"), button:has-text("Confirm Payment")');
    if (await payBtn.isVisible({ timeout: 5_000 }).catch(() => false)) await payBtn.click();

    // Gateway
    await page.waitForURL(
      url => url.href.includes('paychangu.com') || url.href.includes('flutterwave.com'),
      { timeout: 60_000 }
    );
    console.log('[payment] gateway:', page.url());
    await handlePaymentGateway(page);

    // Success
    await page.waitForURL(url => /\/bookings|\/ticket/.test(url.pathname), { timeout: 90_000 });
    await expect(
      page.locator('text=Confirmed, text=confirmed, text=Booking Confirmed').first()
    ).toBeVisible({ timeout: 15_000 });
    console.log('[PASS] booking confirmed');
  });

  // ── My Bookings ─────────────────────────────────────────────────────────────

  test('bookings page shows past bookings', async ({ page }) => {
    await login(page, 'customer');
    await page.goto(`${BASE_URL}/bookings`);
    await page.waitForSelector('main, [data-testid="bookings"]', { timeout: 20_000 });
    // Should not show error
    await expect(page.locator('text=Error, text=Failed').first()).not.toBeVisible();
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function selectStops(page: Page) {
  const boardAt = page.locator('#boardAt, select[name="boardAt"]');
  await boardAt.waitFor({ timeout: 30_000 });
  const boardOptions = await boardAt.locator('option:not([value=""]):not([disabled])').all();
  if (boardOptions.length) {
    await boardAt.selectOption(await boardOptions[0].getAttribute('value') ?? '');
  }
  const alightAt = page.locator('#alightAt, select[name="alightAt"]');
  await alightAt.waitFor({ timeout: 10_000 });
  const alightOptions = await alightAt.locator('option:not([value=""]):not([disabled])').all();
  if (alightOptions.length) {
    await alightAt.selectOption(await alightOptions[alightOptions.length - 1].getAttribute('value') ?? '');
  }
  await page.waitForTimeout(2_000);
}

async function selectFirstAvailableSeat(page: Page) {
  const seat = page.locator(
    'button[data-seat-status="available"]:not([disabled]), ' +
    'button.seat:not(.booked):not(.occupied):not([disabled]), ' +
    '[aria-label*="available"]:not([disabled])'
  ).first();
  await seat.waitFor({ timeout: 30_000 });
  await seat.click();
  console.log('[seat] selected');
}

async function fillPassengerForm(page: Page) {
  await page.waitForSelector('input[name="name"], input[placeholder*="name" i]', { timeout: 60_000 });
  await page.fill('input[name="name"], input[placeholder*="name" i]', 'Test Wisdom');
  const age = page.locator('input[name="ageInput"], input[name="age"]');
  if (await age.isVisible()) await age.fill('28');
  const gender = page.locator('select[name="gender"]');
  if (await gender.isVisible()) await gender.selectOption('male');
  const phone = page.locator('input[name="phone"], input[type="tel"]');
  if (await phone.isVisible()) await phone.fill('+265999999999');
}

async function handlePaymentGateway(page: Page) {
  const url = page.url();
  if (url.includes('paychangu')) {
    const input = page.locator('input[placeholder*="Mobile"], input[placeholder*="Phone"], input[type="tel"]');
    await input.waitFor({ timeout: 20_000 });
    await input.fill('0991457496');
    await page.click('button:has-text("Confirm"), button:has-text("Pay"), button[type="submit"]');
  } else if (url.includes('flutterwave')) {
    await page.waitForSelector('#cardnumber, input[placeholder*="Card"]', { timeout: 20_000 });
    await page.fill('#cardnumber, input[placeholder*="Card number"]', '5531886652142950');
    await page.fill('#expiry, input[placeholder*="MM"]', '09/32');
    await page.fill('#cvv, input[placeholder*="CVV"]',   '564');
    await page.click('button[type="submit"]');
  }
}
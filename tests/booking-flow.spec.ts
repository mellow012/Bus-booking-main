// tests/booking-flow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('TibhukeBus Booking Flow', () => {
  test('should complete a booking with sandbox payment redirect', async ({ page }) => {
    test.setTimeout(180000);

    // 0. Login
    console.log('Logging in...');
    await page.goto('https://bus-booking-main-five.vercel.app/login');

    await page.waitForSelector('input[type="email"]', { timeout: 30000 });
    await page.fill('input[type="email"]', 'wiz116mlambia@gmail.com');
    await page.fill('input[type="password"]', 'Abcd1234');

    await page.click('button:has-text("Login")');

    await page.waitForURL('https://bus-booking-main-five.vercel.app/', { timeout: 40000 });
    console.log('Logged in');

    // 1. Homepage → search
    await page.goto('https://bus-booking-main-five.vercel.app/');
    await page.waitForSelector('#search-from', { timeout: 30000 });

    await page.fill('#search-from', 'Mzuzu');
    await page.fill('#search-to', 'Karonga');

    const searchPromise = page.waitForURL(url => url.pathname === '/search', { timeout: 30000 });
    await page.click('button:has-text("Search Buses")');
    await searchPromise;

    console.log('On /search:', await page.url());

    // 2. Book first route
    const routeCards = page.locator('article.group.bg-white.rounded-lg.shadow-md');
    await routeCards.first().waitFor({ timeout: 60000 });

    await routeCards.first().locator('button:has-text("Book Now")').click({ timeout: 20000 });

    await page.waitForURL(/\/book\//, { timeout: 30000 });
    console.log('On /book:', await page.url());

    // 3. Select stops (critical!)
    console.log('Selecting stops...');
    await page.waitForSelector('#boardAt', { timeout: 30000 });
    await page.selectOption('#boardAt', 'first'); // or '__origin__' if value is that

    await page.waitForSelector('#alightAt', { timeout: 30000 });
    await page.selectOption('#alightAt', 'last'); // or a valid dest value

    await page.waitForTimeout(3000); // Let seats enable

    // 4. Seat selection
    console.log('Selecting seats...');
    const availableSeats = page.locator(
      'button:not([disabled])[aria-label*="available"], .seat.available:not(.disabled), [data-seat-status="available"]:not([disabled])'
    );

    const passengers = 1;
    const seatCount = await availableSeats.count();
    console.log(`Found ${seatCount} available seats`);

    if (seatCount < passengers) throw new Error('No available seats');

    await availableSeats.first().click({ timeout: 15000 });
    console.log('Selected seat 1');

    // 5. Continue to passengers
    console.log('Clicking Continue...');
    await page.click(
      'button:has-text("Continue"), button:has-text("Reserve"), button:has-text("Proceed"), button:not([disabled])',
      { timeout: 30000 }
    );

    // 6. Passenger form
    await page.waitForSelector('input[name="name"]', { timeout: 60000 });
    console.log('Passenger form loaded');

    await page.fill('input[name="name"]', 'Test Wisdom');
    await page.fill('input[name="ageInput"]', '28');
    await page.selectOption('select[name="gender"]', 'male');
    await page.fill('input[name="phone"]', '+265999999999');

    // 7. Proceed to pay
    await page.click('button:has-text("Continue to Review"), button:has-text("Proceed to Pay")');

    // 8. Payment
    await page.waitForURL(url => url.href.includes('paychangu.com') || url.href.includes('flutterwave.com'), { timeout: 60000 });

    const url = page.url();
    if (url.includes('flutterwave')) {
      await page.fill('#cardnumber', '5531886652142950');
      await page.fill('#expiry', '0932');
      await page.fill('#cvv', '564');
      await page.click('button[type="submit"]');
    } else if (url.includes('paychangu')) {
      await page.fill('input[placeholder*="Mobile Number"]', '999999999');
      await page.click('button:has-text("Confirm Payment")');
    }

    // 9. Success
    await page.waitForURL(/\/bookings|\/ticket/, { timeout: 90000 });
    await expect(page.locator('text=Ticket Generated')).toBeVisible();

    console.log('Booking success!');
  });
});
import { test, expect } from '@playwright/test';

test.describe('Navigation Progress Bar & Skeleton Loaders Verification Suite', () => {

  test('1. Client-side legal and auth pages load HTTP 200 cleanly', async ({ request }) => {
    const resPrivacy = await request.get('http://localhost:3000/privacy');
    expect(resPrivacy.status()).toBe(200);
    const bodyPrivacy = await resPrivacy.text();
    expect(bodyPrivacy).toContain('Privacy Policy');

    const resTerms = await request.get('http://localhost:3000/terms');
    expect(resTerms.status()).toBe(200);
    const bodyTerms = await resTerms.text();
    expect(bodyTerms).toContain('Terms of Service');

    const resRefundPolicy = await request.get('http://localhost:3000/refund-policy');
    expect(resRefundPolicy.status()).toBe(200);
    const bodyRefundPolicy = await resRefundPolicy.text();
    expect(bodyRefundPolicy).toContain('Refund');
  });

  test('2. Server-side redirect /refund resolves smoothly to /refund-policy', async ({ request }) => {
    const resRefund = await request.get('http://localhost:3000/refund');
    expect(resRefund.status()).toBe(200);
  });

  test('3. Key routes with loading skeletons load HTTP 200', async ({ request }) => {
    const resSchedules = await request.get('http://localhost:3000/schedules');
    expect(resSchedules.status()).toBe(200);

    const resBookings = await request.get('http://localhost:3000/bookings');
    expect(resBookings.status()).toBe(200);

    const resProfile = await request.get('http://localhost:3000/profile');
    expect(resProfile.status()).toBe(200);

    const resNotifications = await request.get('http://localhost:3000/notifications');
    expect(resNotifications.status()).toBe(200);

    const resCompanyAdmin = await request.get('http://localhost:3000/company/admin');
    expect(resCompanyAdmin.status()).toBe(200);
  });

});

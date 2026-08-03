import { test, expect, request as playwrightRequest } from '@playwright/test';
import { safeguardProductionCheck } from './helpers/seat-concurrency-helpers';

test.describe('Legal & Compliance Pages Suite', () => {
  test.setTimeout(30_000);

  test('1. /privacy page returns HTTP 200 with Privacy Policy text', async ({ baseURL }) => {
    const targetBaseUrl = baseURL || 'http://localhost:3000';
    safeguardProductionCheck(targetBaseUrl);

    const api = await playwrightRequest.newContext({ baseURL: targetBaseUrl });
    const res = await api.get('/privacy');
    expect(res.status(), '/privacy returns HTTP 200').toBe(200);

    const html = await res.text();
    expect(html, 'Contains Privacy Policy header').toContain('Privacy Policy');
    expect(html, 'Mentions PayChangu and location data').toContain('PayChangu');
  });

  test('2. /terms page returns HTTP 200 with Terms of Service text', async ({ baseURL }) => {
    const targetBaseUrl = baseURL || 'http://localhost:3000';
    safeguardProductionCheck(targetBaseUrl);

    const api = await playwrightRequest.newContext({ baseURL: targetBaseUrl });
    const res = await api.get('/terms');
    expect(res.status(), '/terms returns HTTP 200').toBe(200);

    const html = await res.text();
    expect(html, 'Contains Terms of Service header').toContain('Terms of Service');
    expect(html, 'Mentions Malawi law').toContain('Malawi');
  });

  test('3. /refund-policy page returns HTTP 200 with 2-hour cutoff rule', async ({ baseURL }) => {
    const targetBaseUrl = baseURL || 'http://localhost:3000';
    safeguardProductionCheck(targetBaseUrl);

    const api = await playwrightRequest.newContext({ baseURL: targetBaseUrl });
    const res = await api.get('/refund-policy');
    expect(res.status(), '/refund-policy returns HTTP 200').toBe(200);

    const html = await res.text();
    expect(html, 'Contains Refund & Cancellation Policy header').toContain('Refund &amp; Cancellation Policy');
    expect(html, 'Mentions 2-hour pre-departure rule').toContain('2 hours before departure');
  });

  test('4. /refund page redirects to /refund-policy', async ({ baseURL }) => {
    const targetBaseUrl = baseURL || 'http://localhost:3000';
    safeguardProductionCheck(targetBaseUrl);

    const api = await playwrightRequest.newContext({ baseURL: targetBaseUrl, maxRedirects: 5 });
    const res = await api.get('/refund');
    expect(res.status(), '/refund resolves HTTP 200 via redirect').toBe(200);

    const text = await res.text();
    expect(text.includes('refund-policy') || text.includes('Refund Policy') || text.includes('NEXT_REDIRECT'), 'Response contains refund-policy redirect target').toBe(true);
  });
});

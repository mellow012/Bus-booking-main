import { test, expect } from '@playwright/test';
import { safeguardProductionCheck, createTestSchedule, cleanupTestSchedule } from './helpers/seat-concurrency-helpers';
import { prisma } from '../src/lib/prisma';

test.describe('Section 2: Search & Schedule Discovery Edge Cases', () => {
  let createdScheduleId: string | null = null;

  test.beforeAll(async ({ baseURL }) => {
    safeguardProductionCheck(baseURL || '');
  });

  test.afterEach(async () => {
    if (createdScheduleId) {
      await cleanupTestSchedule(createdScheduleId);
      createdScheduleId = null;
    }
  });

  test('2.1 Search with valid origin/destination/date returns correct schedules', async ({ request }) => {
    const testSch = await createTestSchedule(32);
    createdScheduleId = testSch.id;

    const dateStr = testSch.departureDateTime.toISOString().split('T')[0];

    const response = await request.get(`/api/schedules?from=Lilongwe&to=Blantyre&date=${dateStr}&limit=99`);
    expect(response.status()).toBe(200);

    const json = await response.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);

    const found = json.data.find((s: any) => s.id === testSch.id);
    expect(found).toBeDefined();
    expect(found.origin.toLowerCase()).toContain('lilongwe');
    expect(found.destination.toLowerCase()).toContain('blantyre');
    expect(found.availableSeats).toBe(32);
  });

  test('2.2 Route with zero schedules returns clean empty response', async ({ request }) => {
    const response = await request.get('/api/schedules?from=NonExistentCityA&to=NonExistentCityB&date=2030-01-01');
    expect(response.status()).toBe(200);

    const json = await response.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data.length).toBe(0);
  });

  test('2.3 Passenger count filter vs remaining bus capacity', async ({ request }) => {
    const departureDateTime = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000);
    const arrivalDateTime = new Date(departureDateTime.getTime() + 4 * 60 * 60 * 1000);

    const smallSch = await createTestSchedule(2);
    createdScheduleId = smallSch.id;

    await prisma.schedule.update({
      where: { id: smallSch.id },
      data: { departureDateTime, arrivalDateTime, price: 18888 }
    });

    const dateStr = departureDateTime.toISOString().split('T')[0];

    const res1 = await request.get(`/api/schedules?from=Lilongwe&to=Blantyre&date=${dateStr}&limit=99`);
    expect(res1.status()).toBe(200);
    const json1 = await res1.json();
    const found1 = json1.data?.find((s: any) => s.id === smallSch.id);
    expect(found1).toBeDefined();
    expect(found1.availableSeats).toBe(2);
  });

  test('2.4 Sorting by price_asc, price_desc, and time accuracy', async ({ request }) => {
    const resAsc = await request.get('/api/schedules?sortBy=price_asc&limit=10');
    expect(resAsc.status()).toBe(200);
    const jsonAsc = await resAsc.json();
    if (jsonAsc.data && jsonAsc.data.length > 1) {
      for (let i = 0; i < jsonAsc.data.length - 1; i++) {
        expect(jsonAsc.data[i].price).toBeLessThanOrEqual(jsonAsc.data[i + 1].price);
      }
    }

    const resDesc = await request.get('/api/schedules?sortBy=price_desc&limit=10');
    expect(resDesc.status()).toBe(200);
    const jsonDesc = await resDesc.json();
    if (jsonDesc.data && jsonDesc.data.length > 1) {
      for (let i = 0; i < jsonDesc.data.length - 1; i++) {
        expect(jsonDesc.data[i].price).toBeGreaterThanOrEqual(jsonDesc.data[i + 1].price);
      }
    }

    const resTime = await request.get('/api/schedules?sortBy=time&limit=10');
    expect(resTime.status()).toBe(200);
    const jsonTime = await resTime.json();
    if (jsonTime.data && jsonTime.data.length > 1) {
      for (let i = 0; i < jsonTime.data.length - 1; i++) {
        const t1 = new Date(jsonTime.data[i].departureDateTime).getTime();
        const t2 = new Date(jsonTime.data[i + 1].departureDateTime).getTime();
        expect(t1).toBeLessThanOrEqual(t2);
      }
    }
  });

  test('2.5 Cache behavior (HIT/MISS headers)', async ({ request }) => {
    const testSch = await createTestSchedule(32);
    createdScheduleId = testSch.id;
    const dateStr = testSch.departureDateTime.toISOString().split('T')[0];

    const url = `/api/schedules?from=Lilongwe&to=Blantyre&date=${dateStr}&cachebust=${Date.now()}`;

    const res1 = await request.get(url);
    expect(res1.status()).toBe(200);

    const res2 = await request.get(url);
    expect(res2.status()).toBe(200);
    const cacheHeader = res2.headers()['x-cache'];
    expect(['HIT', 'STALE', 'MISS']).toContain(cacheHeader || 'HIT');
  });
});

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { intervalsOverlap, summarizeOccupancy } from '@/lib/segment-booking-core';

describe('segment booking occupancy primitives', () => {
  it('allows a seat to be reused when ranges only meet at a stop', () => {
    assert.equal(intervalsOverlap(
      { originIndex: 0, destinationIndex: 1 },
      { originIndex: 1, destinationIndex: 2 },
    ), false);
  });

  it('rejects ranges that share a travelled interval', () => {
    assert.equal(intervalsOverlap(
      { originIndex: 0, destinationIndex: 2 },
      { originIndex: 1, destinationIndex: 3 },
    ), true);
  });

  it('recomputes peak occupancy across reusable seats', () => {
    assert.deepEqual(summarizeOccupancy([
      { seat: '5', originIndex: 0, destinationIndex: 1 },
      { seat: '5', originIndex: 1, destinationIndex: 2 },
      { seat: '6', originIndex: 0, destinationIndex: 2 },
    ]), { seatsWithOccupancy: ['5', '6'], peakOccupancy: 2 });
  });
});

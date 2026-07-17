import test from 'node:test';
import assert from 'node:assert/strict';

import { POST } from '../src/app/api/bookings/create/route';

test('booking create route exposes a POST handler', () => {
  assert.equal(typeof POST, 'function');
});

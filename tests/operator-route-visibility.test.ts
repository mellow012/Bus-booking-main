import assert from 'node:assert/strict';
import { getVisibleAssignedRoutes } from '../src/app/company/operator/dashboard/_lib/route-display';

const routes = [
  { id: 'r1', name: 'Route A', regionId: 'north' },
  { id: 'r2', name: 'Route B' },
  { id: 'r3', name: 'Route C', regionId: 'south' },
];

const profile = { region: 'north', branch: ['north'] };

const visible = getVisibleAssignedRoutes(routes, profile);
assert.equal(visible.length, 2, 'routes without region metadata and matching region should be visible');
assert.ok(visible.some((route) => route.id === 'r2'));
assert.ok(visible.some((route) => route.id === 'r1'));
assert.ok(!visible.some((route) => route.id === 'r3'));
console.log('operator route visibility test passed');

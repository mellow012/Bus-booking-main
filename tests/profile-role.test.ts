import assert from 'node:assert/strict';
import { resolveEffectiveProfileRole } from '../src/lib/profile-role';

const cases = [
  {
    name: 'prefers the authenticated admin role over a stale customer profile role',
    profileRole: 'customer',
    authRole: 'superadmin',
    expected: 'superadmin',
  },
  {
    name: 'falls back to the profile role when auth role is missing',
    profileRole: 'company_admin',
    authRole: null,
    expected: 'company_admin',
  },
];

for (const testCase of cases) {
  const resolved = resolveEffectiveProfileRole(testCase.profileRole, testCase.authRole);
  assert.equal(resolved, testCase.expected, `${testCase.name} failed`);
}

console.log('profile role resolution tests passed');

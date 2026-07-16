/**
 * db.actions.ts — Barrel re-export
 *
 * This file is intentionally kept as a single re-export hub so that all
 * existing consumers (`import * as dbActions from '@/lib/actions/db.actions'`)
 * continue working without any changes.
 *
 * The actual implementations live in domain-specific files:
 *   - user.actions.ts       → user CRUD
 *   - booking.actions.ts    → bookings & seat reservations
 *   - schedule.actions.ts   → schedules & schedule templates
 *   - fleet.actions.ts      → buses & routes
 *   - company.actions.ts    → companies & admin dashboard stats
 *   - activity.actions.ts   → activity logs & notifications
 *   - messaging.actions.ts  → team messaging (conversations, messages)
 */

export * from './user.actions';
export * from './booking.actions';
export * from './schedule.actions';
export * from './fleet.actions';
export * from './company.actions';
export * from './activity.actions';
export * from './messaging.actions';
export * from './trip.actions';

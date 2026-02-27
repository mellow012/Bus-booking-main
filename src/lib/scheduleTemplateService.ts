
// =============================================================================
// lib/scheduleTemplateService.ts  — call from a Cloud Function or admin panel
// =============================================================================
//
// Usage (from your admin dashboard "Generate Schedules" button):
//
//   import { materializeSchedules } from '@/lib/scheduleTemplateService';
//   const result = await materializeSchedules(companyId, user.uid);
//   console.log(`Created ${result.created} schedules`);
//
// The function is fully IDEMPOTENT: running it multiple times is safe because
// each schedule document has a deterministic ID:  tpl_{templateId}_{YYYY-MM-DD}
// and is written with { merge: true } so existing bookings / seat counts are
// never overwritten.
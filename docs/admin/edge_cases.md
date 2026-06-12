# Chief of Growth Dashboard — Edge Cases & Mitigations

This document lists notable edge cases for the admin dashboard and recommended mitigations.

1. Stale session cookie (sessionVersion mismatch)
   - Symptom: Admin performs action but server rejects due to role mismatch.
   - Cause: Short-lived `tb_session_meta` cookie still present but `users.sessionVersion` incremented.
   - Mitigation: Middleware validates cookie `session_version` against DB and falls back to Supabase verification. Increment `sessionVersion` on role changes (implemented).

2. Partial writes during role change (race)
   - Symptom: Role updated in one table but audit/logging fails.
   - Mitigation: Use a transaction to update `user.role`, increment `sessionVersion`, and write an `activityLog` audit entry in the same transaction when possible.

3. Export abuse / data exfiltration
   - Symptom: Large CSV exports causing high DB load or data leakage.
   - Mitigation: Rate-limit exports per admin user and per IP; require `export_data` audit entries; consider asynchronous export (enqueue job + S3 temporary URL) and permission checks.

4. Missing company scoping
   - Symptom: `company_admin` sees users outside their company.
   - Mitigation: Enforce company scoping server-side (see `getAdminUsers`) and add DB-level RLS policies for defense-in-depth.

5. Audit log write failures
   - Symptom: Actions do not have audit entries.
   - Mitigation: Log failures server-side and emit a metric/alert. Do not block admin actions on audit write failure, but raise an internal alert.

6. Pagination consistency
   - Symptom: Items shift pages under concurrent updates.
   - Mitigation: Prefer cursor-based pagination with deterministic ordering (e.g., `updatedAt,id`) when possible. For quick implementation, keep page-based but accept eventual inconsistencies.

7. Race during impersonation or role escalation
   - Symptom: Admin escalates privileges for a user who has an active session.
   - Mitigation: Increment `sessionVersion` on privilege changes so cached session cookies are invalidated. Consider forcing logout via Supabase sign-out for affected sessions if possible.

8. Large result sets causing timeouts
   - Symptom: `getAdminUsers` with no filters returns too many rows.
   - Mitigation: Enforce `limit` cap (already done in helper), require filters for exports, and add background export job for large datasets.

9. Sensitive data exposure in client
   - Symptom: Client accidentally renders PII in logs or debug.
   - Mitigation: Avoid logging PII in client and server logs. Use `logger` with structured redaction for sensitive fields.

10. Rate limiting & brute force
    - Symptom: Excessive API calls from a compromised admin key.
    - Mitigation: Add rate-limiting middleware, alerting for unusual admin activity, and require 2FA for privileged roles.

11. DB migration rollbacks
    - Symptom: Migration fails mid-run (e.g., adding `sessionVersion`).
    - Mitigation: Test migrations in staging; write reversible SQL; have a rollback plan and downtime window for risky schema changes.

12. Cross-region latency for large companies
    - Symptom: Dashboard queries slow for multi-region deployments.
    - Mitigation: Add read replicas, cache aggregates, and precompute heavy metrics (daily reports) instead of running complex joins on demand.

---

Keep this file updated as new edge cases are discovered during QA and staging runs.

-- Row Level Security (RLS) policy templates for Bus Booking app
-- NOTE: These are templates. Adapt `auth.role()` / `auth.uid()` checks to your JWT claim names
-- and Supabase configuration. Test in a staging DB before applying to production.

-- Enable RLS on key tables
ALTER TABLE IF EXISTS "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "Booking" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "Schedule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "Company" ENABLE ROW LEVEL SECURITY;

-- -----------------------------
-- Users: allow owners and superadmins
-- -----------------------------
-- Superadmins: full access
CREATE POLICY "Users: superadmin full access" ON "User"
  USING (auth.role() = 'superadmin')
  WITH CHECK (auth.role() = 'superadmin');

-- Owners: read/write their own profile
CREATE POLICY "Users: owner read/write" ON "User"
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Company admins: limited read access to users of their company
CREATE POLICY "Users: company_admin read" ON "User"
  USING (auth.role() = 'company_admin' AND companyId = current_setting('jwt.claims.company_id')::text)
  WITH CHECK (false);

-- -----------------------------
-- Bookings: owners and company staff
-- -----------------------------
CREATE POLICY "Bookings: owner" ON "Booking"
  USING (userId = auth.uid())
  WITH CHECK (userId = auth.uid());

CREATE POLICY "Bookings: company staff" ON "Booking"
  USING (companyId = current_setting('jwt.claims.company_id')::text AND auth.role() IN ('company_admin', 'operator'))
  WITH CHECK (false);

-- -----------------------------
-- Schedules: company staff read/write
-- -----------------------------
CREATE POLICY "Schedules: company staff" ON "Schedule"
  USING (companyId = current_setting('jwt.claims.company_id')::text AND auth.role() IN ('company_admin', 'operator'))
  WITH CHECK (companyId = current_setting('jwt.claims.company_id')::text AND auth.role() IN ('company_admin', 'operator'));

-- -----------------------------
-- Company: company_admin scoped
-- -----------------------------
CREATE POLICY "Company: company_admin" ON "Company"
  USING (id = current_setting('jwt.claims.company_id')::text AND auth.role() = 'company_admin')
  WITH CHECK (id = current_setting('jwt.claims.company_id')::text AND auth.role() = 'company_admin');

-- -----------------------------
-- Notes
-- - `auth.uid()` and `auth.role()` are Supabase helper functions that map to JWT claims.
-- - `current_setting('jwt.claims.company_id')` uses Supabase's injected JWT claim for company id.
-- - Adjust claim names according to how you inject `companyId` into JWT (e.g. `company_id`).
-- - Keep administrative policies narrow. Use Postgres functions for complex checks if needed.

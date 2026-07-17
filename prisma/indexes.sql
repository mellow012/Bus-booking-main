-- prisma/indexes.sql
-- Run these commands in the Supabase SQL Editor to optimize performance and enable fuzzy search.

-- 1. Enable pg_trgm extension for fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Fuzzy Search Indexes for Routes (Trigram GIST)
-- These allow fast similarity matching even with typos in city names.
CREATE INDEX IF NOT EXISTS idx_route_origin_fuzzy ON "Route" USING GIST (origin gist_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_route_destination_fuzzy ON "Route" USING GIST (destination gist_trgm_ops);

-- 3. Composite Search Index for Schedules
-- Optimizes the main search query: (date, status, availableSeats)
CREATE INDEX IF NOT EXISTS idx_schedule_search_composite 
ON "Schedule" ("departureDateTime", "status", "availableSeats");

-- 4. User Booking History Index
-- Optimizes "My Bookings" page sorting by date.
CREATE INDEX IF NOT EXISTS idx_booking_user_created 
ON "Booking" ("userId", "createdAt" DESC);

-- 5. Company/Bus lookup optimization
CREATE INDEX IF NOT EXISTS idx_schedule_company_bus 
ON "Schedule" ("companyId", "busId");

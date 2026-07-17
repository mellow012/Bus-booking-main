# Operator Table Setup Guide

## What's Been Done

✅ **Schema Updated** - Added `Operator` model to `prisma/schema.prisma`
✅ **Relations Updated** - Connected to `Route`, `Schedule`, `Bus`, and `Company`
✅ **Seed Script Created** - `prisma/seed_operators.ts` with real credentials

## Running the Migration & Seeding

### Step 1: Run Migration
```bash
npx prisma migrate dev --name add_operator_model
```

This will:
- Create the `Operator` table in PostgreSQL
- Add `operatorId` field to `Schedule` table
- Create proper foreign key relationships

### Step 2: Seed Operators
```bash
npx prisma db seed
```

Or directly:
```bash
npx tsx prisma/seed_operators.ts
```

This will create:
- **Trevor Taulo** (operator) - `trevortaulo03@gmail.com`
- **patrick** (conductor) - `booknpaymw012@gmail.com`

Both linked to **Quantum Tours** company.

## Operator Fields

```prisma
model Operator {
  id                String      @id @default(uuid())
  uid               String      @unique          // Firebase UID
  companyId         String                       // Links to Company
  companyName       String                       // Denormalized name
  email             String      @unique
  name              String
  role              String      // "operator" or "conductor"
  status            String      // "active", "inactive", "suspended"
  region            String?
  
  invitationSent    Boolean     @default(false)
  invitationSentAt  DateTime?
  signupCompletedAt DateTime?
  
  createdBy         String?
  createdAt         DateTime    @default(now())
  updatedAt         DateTime    @updatedAt
  
  // Relations
  company           Company     @relation(fields: [companyId], references: [id])
  routes            Route[]     @relation("OperatorRoutes")
  schedules         Schedule[]  @relation("OperatorSchedules")
  buses             Bus[]       @relation("OperatorBuses")
}
```

## Database URL (from .env)
```
DATABASE_URL=postgresql://postgres.ltypsfmlloiouzwhbwcj:Quantumbyteslab%4099@aws-1-eu-central-2.pooler.supabase.com:6543/postgres?pgbouncer=true&connect_timeout=600
```

## Next Steps

1. Run the migration command above
2. Run the seed command to insert operator credentials
3. Operators can now:
   - Be assigned to specific schedules via `operatorId`
   - Be linked to routes they operate
   - Be linked to buses they conduct
   - Track their assignments and performance

## Testing

Query operators:
```sql
SELECT * FROM "Operator" WHERE "companyId" = 'Hm8mEWHsFNavNJbCspPt';
```

Check schedule assignments:
```sql
SELECT s.id, s."departureDateTime", o.name 
FROM "Schedule" s 
LEFT JOIN "Operator" o ON s."operatorId" = o.id 
LIMIT 10;
```

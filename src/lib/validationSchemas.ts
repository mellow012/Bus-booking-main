/**
 * Centralized Zod Validation Schemas
 * Reusable schemas for common data types across the app
 */

import { z } from 'zod';

// ─── Email & Auth ──────────────────────────────────────────────────────────

export const emailSchema = z
  .string()
  .email('Invalid email address')
  .toLowerCase()
  .trim();

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[!@#$%^&*]/, 'Password must contain at least one special character (!@#$%^&*)');

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password required'),
});

export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: z.string().min(2, 'First name must be at least 2 characters').max(50).trim(),
  lastName: z.string().min(2, 'Last name must be at least 2 characters').max(50).trim(),
  phone: z.string().optional(),
});

// ─── Phone ─────────────────────────────────────────────────────────────────

export const phoneSchema = z
  .string()
  .regex(/^[\d\s\-\(\)\+]+$/, 'Invalid phone format')
  .min(7, 'Phone number too short')
  .max(20, 'Phone number too long')
  .trim();

// ─── IDs & References ──────────────────────────────────────────────────────

export const uuidSchema = z
  .string()
  .uuid('Invalid UUID format');

export const firebaseUidSchema = z
  .string()
  .min(20, 'Invalid Firebase UID')
  .max(30, 'Invalid Firebase UID')
  .regex(/^[a-zA-Z0-9]+$/, 'Invalid UID format');

// ─── Business Data ─────────────────────────────────────────────────────────

export const companyNameSchema = z
  .string()
  .min(2, 'Company name must be at least 2 characters')
  .max(100, 'Company name too long')
  .trim()
  .regex(/^[a-zA-Z0-9\s\-&,.]+$/, 'Company name contains invalid characters');

export const busNumberSchema = z
  .string()
  .min(3, 'Bus number must be at least 3 characters')
  .max(20, 'Bus number too long')
  .trim()
  .regex(/^[A-Z0-9\-]+$/, 'Bus number must contain only uppercase letters, numbers, and hyphens');

export const amountSchema = z
  .number()
  .positive('Amount must be greater than 0')
  .max(999999, 'Invalid amount')
  .finite('Invalid amount');

export const currencySchema = z
  .enum(['mwk', 'usd', 'gbp', 'eur', 'zar'])
  .catch('mwk');

// ─── Records & Identifiers ─────────────────────────────────────────────────

export const nationalIdSchema = z
  .string()
  .min(8, 'National ID too short')
  .max(20, 'National ID too long')
  .regex(/^[a-zA-Z0-9]+$/, 'Invalid National ID format');

export const countryCodeSchema = z
  .string()
  .length(2, 'Country code must be 2 characters')
  .regex(/^[A-Z]+$/, 'Invalid country code format');

// ─── Pagination & Filtering ─────────────────────────────────────────────────

export const paginationSchema = z.object({
  page: z.number().int().min(1, 'Page must be at least 1').default(1),
  limit: z.number().int().min(1).max(100).default(10),
});

export const sortOrderSchema = z.enum(['asc', 'desc']).catch('asc');

// ─── Booking Data ──────────────────────────────────────────────────────────

export const bookingSchema = z.object({
  bookingId: uuidSchema,
  scheduleId: uuidSchema,
  userId: firebaseUidSchema,
  numberOfPassengers: z
    .number()
    .int()
    .min(1, 'At least 1 passenger required')
    .max(50, 'Too many passengers'),
  totalAmount: amountSchema,
  currency: currencySchema,
  paymentStatus: z.enum(['pending', 'processing', 'paid', 'failed']),
});

// ─── Payment Data ──────────────────────────────────────────────────────────

export const paymentInitiateSchema = z.object({
  bookingId: uuidSchema,
  paymentProvider: z.enum(['stripe', 'paychangu'], {
    message: 'Invalid payment provider',
  }),
  customerDetails: z
    .object({
      email: emailSchema,
      phone: phoneSchema.optional(),
      name: z.string().min(2).max(100).trim(),
    })
    .strict(),
  metadata: z.record(z.string(), z.any()).optional(),
});

// ─── Notification Data ──────────────────────────────────────────────────────

export const notificationSchema = z.object({
  recipientIds: z.array(firebaseUidSchema).min(1, 'At least one recipient required'),
  title: z.string().min(1, 'Title required').max(200),
  body: z.string().min(1, 'Body required').max(4096),
  data: z.record(z.string(), z.any()).optional(),
  icon: z.string().url('Invalid icon URL').optional(),
  clickAction: z.string().url('Invalid click action URL').optional(),
});

// ─── Profile Data ──────────────────────────────────────────────────────────

export const profileUpdateSchema = z.object({
  firstName: z.string().min(2).max(50).trim().optional(),
  lastName: z.string().min(2).max(50).trim().optional(),
  phone: phoneSchema.optional(),
  nationalId: nationalIdSchema.optional(),
  sex: z.enum(['male', 'female', 'other']).optional(),
  currentAddress: z.string().max(200).trim().optional(),
}).strict();

// ─── Search & Query Params ─────────────────────────────────────────────────

export const searchParamsSchema = z.object({
  from: z.string().min(1, 'Departure required').trim().optional(),
  to: z.string().min(1, 'Destination required').trim().optional(),
  date: z.string().datetime({ offset: true }).optional(),
  page: z.string().regex(/^[0-9]+$/, 'Page must be a number').optional(),
  limit: z.string().regex(/^[0-9]+$/, 'Limit must be a number').optional(),
});

// ─── Helper: Sanitize string inputs ─────────────────────────────────────────

export function sanitizeString(input: string): string {
  return input
    .trim()
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .slice(0, 1000); // Limit length
}

export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
  const sanitized: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value);
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized as T;
}

// ─── Safe Schema Parse with Error Logging ──────────────────────────────────

interface ParseOptions {
  logErrors?: boolean;
  context?: string;
}

export async function safeParse<T>(
  schema: z.ZodSchema,
  data: unknown,
  options: ParseOptions = {}
): Promise<{ success: boolean; data?: T; errors?: z.ZodError }> {
  try {
    const result = schema.parse(data);
    return { success: true, data: result as T };
  } catch (error) {
    if (error instanceof z.ZodError && options.logErrors) {
      console.error(`[Validation Error] ${options.context || 'Parse error'}:`, 
        error.issues.map(i => `${i.path.join('.')}: ${i.message}`)
      );
    }
    return {
      success: false,
      errors: error instanceof z.ZodError ? error : undefined,
    };
  }
}

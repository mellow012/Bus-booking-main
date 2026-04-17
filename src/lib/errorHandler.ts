/**
 * Standardized Error Handling & Response Utilities
 * Ensures consistent error responses across all API endpoints
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from './logger';

/**
 * Standardized API Error Response
 */
export interface APIErrorResponse {
  success: false;
  error: {
    code: string; // Machine-readable error code
    message: string; // User-friendly message
    status: number; // HTTP status code
    timestamp: string;
    requestId?: string; // For tracking
    details?: Record<string, any>; // Dev info (only in dev mode)
  };
}

/**
 * Standardized API Success Response
 */
export interface APISuccessResponse<T = any> {
  success: true;
  data: T;
  message?: string;
  timestamp: string;
}

/**
 * Error codes mapping
 */
export enum ErrorCode {
  // Authentication & Authorization
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  AUTH_FAILED = 'AUTH_FAILED',

  // Input Validation
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT = 'INVALID_FORMAT',
  INVALID_ENUM_VALUE = 'INVALID_ENUM_VALUE',

  // Rate Limiting & Abuse
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS',

  // Resource Errors
  NOT_FOUND = 'NOT_FOUND',
  RESOURCE_ALREADY_EXISTS = 'RESOURCE_ALREADY_EXISTS',
  CONFLICT = 'CONFLICT',

  // Business Logic Errors
  INVALID_STATE = 'INVALID_STATE',
  OPERATION_NOT_ALLOWED = 'OPERATION_NOT_ALLOWED',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',

  // Payment & Financial
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  PAYMENT_CANCELLED = 'PAYMENT_CANCELLED',
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',

  // Server Errors
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
}

/**
 * Error severity levels for logging
 */
export enum ErrorSeverity {
  LOW = 'low', // Validation errors, expected errors
  MEDIUM = 'medium', // Business logic errors, auth failures
  HIGH = 'high', // Database errors, external service failures
  CRITICAL = 'critical', // System failures
}

/**
 * Application Error class
 */
export class APIError extends Error {
  constructor(
    public code: ErrorCode,
    public message: string,
    public status: number = 400,
    public severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    public details?: Record<string, any>,
    public shouldLogStackTrace: boolean = true
  ) {
    super(message);
    this.name = 'APIError';
  }
}

/**
 * Create error response
 */
export function createErrorResponse(
  error: APIError | Error | unknown,
  userId?: string,
  requestId?: string
): NextResponse<APIErrorResponse> {
  const isDevelopment = process.env.NODE_ENV === 'development';
  let apiError: APIError;

  // Parse error
  if (error instanceof APIError) {
    apiError = error;
  } else if (error instanceof z.ZodError) {
    apiError = new APIError(
      ErrorCode.VALIDATION_ERROR,
      'Request validation failed',
      400,
      ErrorSeverity.LOW,
      {
        issues: error.issues.map(i => ({
          field: i.path.join('.'),
          message: i.message,
        })),
      },
      false
    );
  } else if (error instanceof Error) {
    // Generic error - don't leak stack traces
    apiError = new APIError(
      ErrorCode.INTERNAL_SERVER_ERROR,
      'An unexpected error occurred. ' + (isDevelopment ? error.message : 'Please try again later.'),
      500,
      ErrorSeverity.HIGH,
      isDevelopment ? { originalError: error.message } : undefined,
      true
    );
  } else {
    apiError = new APIError(
      ErrorCode.INTERNAL_SERVER_ERROR,
      'An unknown error occurred',
      500,
      ErrorSeverity.CRITICAL,
      undefined,
      false
    );
  }

  // Log error
  logError(apiError, userId, requestId);

  // Build response
  const response: APIErrorResponse = {
    success: false,
    error: {
      code: apiError.code,
      message: apiError.message,
      status: apiError.status,
      timestamp: new Date().toISOString(),
      requestId,
      ...(isDevelopment && { details: apiError.details }),
    },
  };

  return NextResponse.json(response, {
    status: apiError.status,
    headers: {
      'Content-Type': 'application/json',
      ...(apiError.status === 429 && { 'Retry-After': '60' }),
    },
  });
}

/**
 * Create success response
 */
export function createSuccessResponse<T>(
  data: T,
  message?: string
): NextResponse<APISuccessResponse<T>> {
  const response: APISuccessResponse<T> = {
    success: true,
    data,
    message,
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(response, { status: 200 });
}

/**
 * Log error with appropriate severity
 */
async function logError(
  error: APIError,
  userId?: string,
  requestId?: string
): Promise<void> {
  const isDevelopment = process.env.NODE_ENV === 'development';

  if (error.severity === ErrorSeverity.LOW) {
    // Low severity - just log as warning
    await logger.logWarning('api', error.message, {
      userId,
      action: `error_${error.code}`,
      metadata: {
        code: error.code,
        status: error.status,
        requestId,
        ...error.details,
      },
    });
  } else {
    // Medium, High, Critical - log as error
    await logger.logError('api', error.message, error, {
      userId,
      action: `error_${error.code}`,
      metadata: {
        code: error.code,
        status: error.status,
        severity: error.severity,
        requestId,
        ...error.details,
      },
    });
  }
}

/**
 * Common error creators for quick use
 */
export class Errors {
  static unauthorized(message: string = 'Unauthorized'): APIError {
    return new APIError(
      ErrorCode.UNAUTHORIZED,
      message,
      401,
      ErrorSeverity.LOW
    );
  }

  static forbidden(message: string = 'Forbidden'): APIError {
    return new APIError(
      ErrorCode.FORBIDDEN,
      message,
      403,
      ErrorSeverity.LOW
    );
  }

  static notFound(resource: string = 'Resource'): APIError {
    return new APIError(
      ErrorCode.NOT_FOUND,
      `${resource} not found`,
      404,
      ErrorSeverity.LOW
    );
  }

  static validationError(details: Record<string, any>): APIError {
    return new APIError(
      ErrorCode.VALIDATION_ERROR,
      'Validation failed',
      400,
      ErrorSeverity.LOW,
      details,
      false
    );
  }

  static rateLimitExceeded(retryAfter?: number): APIError {
    return new APIError(
      ErrorCode.RATE_LIMIT_EXCEEDED,
      `Too many requests. Try again in ${retryAfter || 60} seconds.`,
      429,
      ErrorSeverity.LOW,
      { retryAfter },
      false
    );
  }

  static conflict(message: string): APIError {
    return new APIError(
      ErrorCode.CONFLICT,
      message,
      409,
      ErrorSeverity.LOW
    );
  }

  static alreadyExists(resource: string): APIError {
    return new APIError(
      ErrorCode.RESOURCE_ALREADY_EXISTS,
      `${resource} already exists`,
      409,
      ErrorSeverity.LOW
    );
  }

  static paymentFailed(message: string = 'Payment processing failed'): APIError {
    return new APIError(
      ErrorCode.PAYMENT_FAILED,
      message,
      400,
      ErrorSeverity.MEDIUM
    );
  }

  static databaseError(isDevelopment: boolean = false): APIError {
    return new APIError(
      ErrorCode.DATABASE_ERROR,
      isDevelopment
        ? 'Database error occurred'
        : 'An error occurred while processing your request',
      500,
      ErrorSeverity.HIGH,
      undefined,
      isDevelopment
    );
  }

  static externalServiceError(message: string = 'External service error'): APIError {
    return new APIError(
      ErrorCode.EXTERNAL_SERVICE_ERROR,
      message,
      503,
      ErrorSeverity.HIGH
    );
  }

  static serviceUnavailable(): APIError {
    return new APIError(
      ErrorCode.SERVICE_UNAVAILABLE,
      'Service temporarily unavailable. Please try again later.',
      503,
      ErrorSeverity.HIGH
    );
  }

  static accountLocked(minutesRemaining?: number): APIError {
    return new APIError(
      ErrorCode.ACCOUNT_LOCKED,
      minutesRemaining
        ? `Account is locked for ${minutesRemaining} more minutes`
        : 'Account is temporarily locked',
      423,
      ErrorSeverity.MEDIUM
    );
  }
}

/**
 * Wrapper for async API handlers with centralized error handling
 */
export function withErrorHandling(
  handler: (req: any, context?: any) => Promise<NextResponse>
) {
  return async (req: any, context?: any): Promise<NextResponse> => {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      return await handler(req, context);
    } catch (error) {
      return createErrorResponse(error, undefined, requestId);
    }
  };
}

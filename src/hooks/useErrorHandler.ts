import { useState, useCallback } from 'react';

interface ErrorState {
  message: string;
  code?: string;
  details?: string;
  retryable?: boolean;
}

interface UseErrorHandlerReturn {
  error: ErrorState | null;
  isError: boolean;
  setError: (error: ErrorState | null) => void;
  clearError: () => void;
  handleError: (error: unknown) => void;
}

/**
 * Hook for centralized error handling with retry capability
 * Usage:
 * ```tsx
 * const { error, handleError, clearError } = useErrorHandler();
 * 
 * try {
 *   const data = await fetchData();
 * } catch (err) {
 *   handleError(err);
 * }
 * 
 * if (error) {
 *   return <ErrorAlert error={error} onRetry={refetch} onDismiss={clearError} />;
 * }
 * ```
 */
export function useErrorHandler(): UseErrorHandlerReturn {
  const [error, setError] = useState<ErrorState | null>(null);

  const handleError = useCallback((error: unknown) => {
    if (error instanceof Error) {
      setError({
        message: error.message || 'An error occurred',
        code: 'ERROR',
        details: error.stack,
        retryable: true,
      });
    } else if (typeof error === 'string') {
      setError({
        message: error,
        code: 'ERROR',
        retryable: true,
      });
    } else if (error && typeof error === 'object' && 'message' in error) {
      const err = error as Record<string, unknown>;
      setError({
        message: (err.message as string) || 'An error occurred',
        code: (err.code as string) || 'ERROR',
        details: (err.details as string) || undefined,
        retryable: (err.retryable as boolean) !== false,
      });
    } else {
      setError({
        message: 'An unexpected error occurred',
        code: 'UNKNOWN_ERROR',
        retryable: true,
      });
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    error,
    isError: error !== null,
    setError,
    clearError,
    handleError,
  };
}

/**
 * Format error message for user display
 */
export function formatErrorMessage(code: string): string {
  const messages: Record<string, string> = {
    'NETWORK_ERROR': 'Network connection failed. Please check your internet.',
    'TIMEOUT': 'Request timed out. Please try again.',
    'UNAUTHORIZED': 'You are not authorized to perform this action.',
    'NOT_FOUND': 'The requested resource was not found.',
    'VALIDATION_ERROR': 'Please check your input and try again.',
    'SERVER_ERROR': 'Server error. Please try again later.',
    'UNKNOWN_ERROR': 'An unexpected error occurred. Please try again.',
  };

  return messages[code] || 'An error occurred. Please try again.';
}

/**
 * useCSRFToken Hook
 * Manages CSRF token for API requests
 */

'use client';

import { useEffect, useState, useCallback } from 'react';

/**
 * Fetch and manage CSRF token
 */
export function useCSRFToken() {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch token on mount
  useEffect(() => {
    const fetchCSRFToken = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/csrf-token', {
          method: 'GET',
          credentials: 'include', // Include cookies
        });

        if (!response.ok) {
          throw new Error('Failed to fetch CSRF token');
        }

        const data = await response.json();
        setToken(data.token);
        setError(null);

        console.log('[CSRF] Token retrieved:', data.token.substring(0, 20) + '...');
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMsg);
        console.error('[CSRF] Token fetch error:', errorMsg);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCSRFToken();
  }, []);

  /**
   * Attach CSRF token to fetch request headers
   */
  const attachTokenToRequest = useCallback(
    (init?: RequestInit): RequestInit => {
      if (!token) {
        console.warn('[CSRF] No token available for request');
        return init || {};
      }

      return {
        ...init,
        headers: {
          ...(init?.headers || {}),
          'X-CSRF-Token': token,
        },
      };
    },
    [token]
  );

  /**
   * Safe fetch wrapper that includes CSRF token
   */
  const securedFetch = useCallback(
    async (url: string, init?: RequestInit) => {
      const requestInit = attachTokenToRequest(init);
      return fetch(url, requestInit);
    },
    [attachTokenToRequest]
  );

  return {
    token,
    isLoading,
    error,
    hasToken: token !== null,
    attachTokenToRequest,
    securedFetch,
  };
}

/**
 * Wrapper for fetch that automatically includes CSRF token
 * Usage: const response = await secureFetch('/api/endpoint', { method: 'POST', body: ... })
 */
export async function secureFetch(
  url: string,
  token: string | null,
  init?: RequestInit
): Promise<Response> {
  if (!token) {
    throw new Error('No CSRF token available');
  }

  return fetch(url, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      'X-CSRF-Token': token,
    },
  });
}

/**
 * Search Storage Utility
 * Manages storing and retrieving search criteria from localStorage
 * Used to preserve user searches through login/registration flow
 */

export interface StoredSearch {
  from: string;
  to: string;
  date: string;
  passengers: number;
  timestamp: number;
}

const SEARCH_STORAGE_KEY = 'pending_search';
const SEARCH_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Store search criteria in localStorage
 * Called when user tries to search but isn't authenticated
 */
export const storePendingSearch = (search: { from: string; to: string; date: string; passengers: number }): void => {
  if (typeof window === 'undefined') return;
  
  try {
    const stored: StoredSearch = {
      ...search,
      timestamp: Date.now(),
    };
    localStorage.setItem(SEARCH_STORAGE_KEY, JSON.stringify(stored));
  } catch (err) {
    console.error('Failed to store pending search:', err);
  }
};

/**
 * Retrieve stored search criteria from localStorage
 * Returns null if no valid stored search exists or if it's expired
 */
export const getPendingSearch = (): StoredSearch | null => {
  if (typeof window === 'undefined') return null;
  
  try {
    const stored = localStorage.getItem(SEARCH_STORAGE_KEY);
    if (!stored) return null;
    
    const search: StoredSearch = JSON.parse(stored);
    
    // Check if search has expired
    if (Date.now() - search.timestamp > SEARCH_EXPIRY) {
      clearPendingSearch();
      return null;
    }
    
    return search;
  } catch (err) {
    console.error('Failed to retrieve pending search:', err);
    return null;
  }
};

/**
 * Clear stored search criteria from localStorage
 * Called after successfully redirecting to schedules with search
 */
export const clearPendingSearch = (): void => {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.removeItem(SEARCH_STORAGE_KEY);
  } catch (err) {
    console.error('Failed to clear pending search:', err);
  }
};

/**
 * Build redirect URL with search parameters
 * Used after profile completion
 */
export const buildSearchRedirectUrl = (search: StoredSearch): string => {
  const params = new URLSearchParams({
    from: search.from,
    to: search.to,
    date: search.date,
    passengers: String(search.passengers),
  });
  return `/schedules?${params.toString()}`;
};

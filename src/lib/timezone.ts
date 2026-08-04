/**
 * Centralized Timezone Utilities for Malawi (CAT / Africa/Blantyre / UTC+2)
 */

export const MALAWI_TIMEZONE = 'Africa/Blantyre';

/**
 * Returns today's date formatted as YYYY-MM-DD in Malawi time (UTC+2)
 */
export function getTodayDateString(): string {
  const d = new Date();
  return d.toLocaleDateString('en-CA', { timeZone: MALAWI_TIMEZONE });
}

/**
 * Returns tomorrow's date formatted as YYYY-MM-DD in Malawi time (UTC+2)
 */
export function getTomorrowDateString(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toLocaleDateString('en-CA', { timeZone: MALAWI_TIMEZONE });
}

/**
 * Formats a Date object or ISO string into 24-hour time "HH:MM" in Malawi time (UTC+2)
 */
export function formatTime24(date: Date | string | number): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return '00:00';
  return d.toLocaleTimeString('en-GB', {
    timeZone: MALAWI_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * Formats a Date object or ISO string into 12-hour time "hh:mm AM/PM" in Malawi time (UTC+2)
 */
export function formatTime12(date: Date | string | number): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return '12:00 AM';
  return d.toLocaleTimeString('en-US', {
    timeZone: MALAWI_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Formats a Date object or ISO string into YYYY-MM-DD in Malawi time (UTC+2)
 */
export function formatDateISO(date: Date | string | number): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-CA', { timeZone: MALAWI_TIMEZONE });
}

/**
 * Checks if a YYYY-MM-DD date string or Date object represents today in Malawi time (UTC+2)
 */
export function isTodayMalawi(dateStrOrObj: string | Date): boolean {
  if (!dateStrOrObj) return false;
  if (typeof dateStrOrObj === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStrOrObj)) {
    return dateStrOrObj === getTodayDateString();
  }
  return formatDateISO(dateStrOrObj) === getTodayDateString();
}

/**
 * Safely parses a Date from an API string, ensuring that strings without a timezone 
 * identifier are treated as UTC (resolving PostgREST dropping 'Z' suffixes).
 */
export function parseUtcDate(date: Date | string | number | undefined | null): Date {
  if (!date) return new Date(NaN);
  if (typeof date === 'string') {
    // If it doesn't end with Z and doesn't have a timezone offset like +02:00 or -0500, append Z
    if (!date.endsWith('Z') && !date.match(/[+-]\d{2}:?\d{2}$/)) {
      return new Date(date + 'Z');
    }
  }
  return new Date(date);
}

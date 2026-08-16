// Small shared helpers for chatter UI: robust date parsing and notes parsing
export function toDate(v: any): Date | null {
  if (!v && v !== 0) return null;
  
  const validateDate = (d: Date): Date | null => {
    if (isNaN(d.getTime())) return null;
    const year = d.getFullYear();
    if (year < 2000 || year > 2100) return null;
    return d;
  };

  if (v instanceof Date) return validateDate(v);
  if (typeof v === 'number') return validateDate(new Date(v));
  if (typeof v === 'string') return validateDate(new Date(v));
  
  if (typeof v === 'object') {
    if ('seconds' in v && typeof v.seconds === 'number') return validateDate(new Date(v.seconds * 1000));
    if (v.$date && typeof v.$date === 'string') return validateDate(new Date(v.$date));
    if (typeof v.toDate === 'function') {
      try { 
        const d = v.toDate(); 
        if (d instanceof Date) return validateDate(d); 
      } catch (e) {}
    }
  }
  return null;
}

export function parsePickupDrop(notes?: string) {
  if (!notes) return { pickup: null, dropoff: null };
  const pickupMatch = notes.match(/Pickup:\s*(.*)/i);
  const dropoffMatch = notes.match(/Drop-?off:\s*(.*)/i);
  const pickup = pickupMatch && pickupMatch[1] ? pickupMatch[1].trim() : null;
  const dropoff = dropoffMatch && dropoffMatch[1] ? dropoffMatch[1].trim() : null;
  return { pickup, dropoff };
}

export const CHATTER_GRACE_PERIOD_MS = 48 * 60 * 60 * 1000; // 48 hours

export function isChatterScheduleExpired(travelDate: any): boolean {
  const dt = toDate(travelDate);
  if (!dt) return false;
  return Date.now() > (dt.getTime() + CHATTER_GRACE_PERIOD_MS);
}

export function formatTimeAMPM(timeStr: string | null | undefined): string {
  if (!timeStr) return '-';
  const [h, m] = timeStr.split(':');
  if (!h || !m) return timeStr;
  let hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12;
  hour = hour ? hour : 12;
  return `${hour.toString().padStart(2, '0')}:${m} ${ampm}`;
}

export default { toDate, parsePickupDrop, formatTimeAMPM, isChatterScheduleExpired, CHATTER_GRACE_PERIOD_MS };

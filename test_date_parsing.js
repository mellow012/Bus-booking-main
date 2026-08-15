export function parseUtcDate(date) {
  if (!date) return new Date(NaN);
  if (typeof date === 'string') {
    if (!date.endsWith('Z') && !date.match(/[+-]\d{2}:?\d{2}$/)) {
      return new Date(date + 'Z');
    }
  }
  return new Date(date);
}

const b = {
  chatterSchedule: {
    travelDate: "2026-08-16T10:00:00.000Z",
    departureTime: "08:00"
  }
};

const dt = b.chatterSchedule.departureTime 
  ? parseUtcDate(`${String(b.chatterSchedule.travelDate).split('T')[0]}T${b.chatterSchedule.departureTime}${b.chatterSchedule.departureTime.split(':').length === 2 ? ':00' : ''}`)
  : parseUtcDate(b.chatterSchedule.travelDate);

console.log("Result:", dt);
console.log("Is valid?", !isNaN(dt.getTime()));

const formatTime = (dateTime) => {
    let d;
    if (dateTime instanceof Date) d = dateTime;
    else if (typeof dateTime === 'string') d = parseUtcDate(dateTime);
    else if (dateTime?.seconds) d = new Date(dateTime.seconds * 1000);
    else return 'N/A';
    if (isNaN(d.getTime())) return 'N/A';
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
};

console.log("formatTime:", formatTime(dt));

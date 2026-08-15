export function generateSeatRows(totalSeats: number, seatsPerRow = 4): string[][] {
  const total = Math.max(0, Math.min(Number(totalSeats) || 0, 100));
  const seatNumbers = Array.from({ length: total }, (_, index) => String(index + 1));
  const rows: string[][] = [];

  for (let i = 0; i < seatNumbers.length; i += seatsPerRow) {
    rows.push(seatNumbers.slice(i, i + seatsPerRow));
  }

  return rows;
}

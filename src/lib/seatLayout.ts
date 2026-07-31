export type RowOverrideType = 'asymmetric' | 'bench' | 'block';

export interface RowOverride {
  position: 'first' | 'last' | number;
  type: RowOverrideType;
  leftSeats?: number;
  rightSeats?: number;
  benchSeats?: number;
  label?: string;
}

export interface SeatLayoutPreset {
  name: string;
  seatsPerRow: number;
  aislePosition: number;
  seatLabels: string[];
  defaultFirstRowSeats?: number;
  defaultRowOverrides?: RowOverride[];
}

export type SeatLayoutKey = 'minibus' | 'coaster' | 'coach' | 'luxury';

export const SEAT_LAYOUT_PRESETS: Record<SeatLayoutKey, SeatLayoutPreset> = {
  minibus: {
    name: 'Minibus',
    seatsPerRow: 4,
    aislePosition: 1, // 1+3 layout: 1 seat left of aisle, 3 seats right (A | B C D)
    seatLabels: ['A', 'B', 'C', 'D'],
    // Front row seat count genuinely varies per real minibus (commonly 2 or 3) —
    // 3 is used as a reasonable default, but this should be adjustable per bus
    // in Fleet Manager rather than treated as fixed.
    defaultFirstRowSeats: 3,
    defaultRowOverrides: [{ position: 'last', type: 'bench', benchSeats: 4 }],
  },
  coaster: {
    name: 'Coaster',
    seatsPerRow: 4,
    aislePosition: 2, // 2+2 layout: centered aisle (A B | C D)
    seatLabels: ['A', 'B', 'C', 'D'],
    // Narrower front row (driver cabin/entrance space) — 2 seats by default.
    defaultFirstRowSeats: 2,
    defaultRowOverrides: [{ position: 'last', type: 'bench', benchSeats: 4 }],
  },
  coach: {
    name: 'Coach',
    seatsPerRow: 5,
    aislePosition: 2, // 2+3 layout: centered aisle (A B | C D E)
    seatLabels: ['A', 'B', 'C', 'D', 'E'],
    defaultFirstRowSeats: 2,
    defaultRowOverrides: [{ position: 'last', type: 'bench', benchSeats: 5 }],
  },
  luxury: {
    name: 'Luxury',
    seatsPerRow: 3,
    aislePosition: 2, // 2+1 layout: wider individual seats (A B | C)
    seatLabels: ['A', 'B', 'C'],
    defaultFirstRowSeats: 2,
    defaultRowOverrides: [{ position: 'last', type: 'bench', benchSeats: 4 }],
  },
};

export interface ResolvedSeatLayoutOptions {
  capacity: number;
  seatLayoutKey?: string | null;
  firstRowSeats?: number | null;
  lastRowSeats?: number | null;
  rowOverrides?: RowOverride[] | null;
}

export interface GeneratedRowMeta {
  type: 'standard' | 'asymmetric' | 'bench' | 'block';
  label?: string;
}

export interface GeneratedSeatGridResult {
  grid: (string | null)[][];
  rowMeta: GeneratedRowMeta[];
  preset: SeatLayoutPreset;
  seatsPerRow: number;
  aislePosition: number;
  seatLabels: string[];
  totalRows: number;
  capacity: number;
}

export function generateSeatGrid(options: ResolvedSeatLayoutOptions): GeneratedSeatGridResult {
  const capacity = Math.max(0, Number(options.capacity) || 0);
  const rawKey = (options.seatLayoutKey || 'minibus').toLowerCase().trim();
  const key: SeatLayoutKey = rawKey in SEAT_LAYOUT_PRESETS ? (rawKey as SeatLayoutKey) : 'minibus';
  const preset = SEAT_LAYOUT_PRESETS[key];

  const { seatsPerRow, aislePosition, seatLabels } = preset;

  if (capacity <= 0) {
    return {
      grid: [],
      rowMeta: [],
      preset,
      seatsPerRow,
      aislePosition,
      seatLabels,
      totalRows: 0,
      capacity: 0,
    };
  }

  // Normalize row overrides
  const normalizedOverrides: RowOverride[] = [];

  if (options.rowOverrides && Array.isArray(options.rowOverrides) && options.rowOverrides.length > 0) {
    normalizedOverrides.push(...options.rowOverrides);
  } else {
    // Determine first row seats layout
    const firstSeatsCount = options.firstRowSeats != null && !isNaN(Number(options.firstRowSeats))
      ? Math.min(seatsPerRow, Math.max(1, Number(options.firstRowSeats)))
      : preset.defaultFirstRowSeats || seatsPerRow;

    if (firstSeatsCount < seatsPerRow) {
      // Fill left side of aisle first, then place remaining on right side
      const leftSeats = Math.min(firstSeatsCount, aislePosition);
      const rightSeats = Math.max(0, firstSeatsCount - leftSeats);

      normalizedOverrides.push({
        position: 'first',
        type: 'asymmetric',
        leftSeats,
        rightSeats,
      });
    }

    if (options.lastRowSeats != null && !isNaN(Number(options.lastRowSeats))) {
      normalizedOverrides.push({
        position: 'last',
        type: 'bench',
        benchSeats: Number(options.lastRowSeats),
      });
    } else if (preset.defaultRowOverrides) {
      const defaultLast = preset.defaultRowOverrides.find((o) => o.position === 'last');
      if (defaultLast) {
        normalizedOverrides.push(defaultLast);
      }
    }
  }

  const specificRowOverrides = new Map<number, RowOverride>();
  let firstOverride: RowOverride | null = null;
  let lastOverride: RowOverride | null = null;

  for (const ov of normalizedOverrides) {
    if (ov.position === 'first') firstOverride = ov;
    else if (ov.position === 'last') lastOverride = ov;
    else if (typeof ov.position === 'number' && ov.position > 0) {
      specificRowOverrides.set(ov.position, ov);
    }
  }

  const grid: (string | null)[][] = [];
  const rowMeta: GeneratedRowMeta[] = [];

  let seatsGenerated = 0;
  let currentRowIndex = 1;

  while (seatsGenerated < capacity) {
    const remainingSeats = capacity - seatsGenerated;

    let override: RowOverride | null = null;

    if (currentRowIndex === 1 && firstOverride) {
      override = firstOverride;
    } else if (specificRowOverrides.has(currentRowIndex)) {
      override = specificRowOverrides.get(currentRowIndex)!;
    } else if (
      lastOverride || remainingSeats <= seatsPerRow + 1
    ) {
      const benchTarget = lastOverride?.benchSeats || seatsPerRow;
      if (remainingSeats <= benchTarget + 1 || seatsGenerated + seatsPerRow >= capacity) {
        override = lastOverride || { position: 'last', type: 'bench', benchSeats: remainingSeats };
      }
    }

    if (override) {
      if (override.type === 'block') {
        const row: (string | null)[] = Array(seatsPerRow).fill(null);
        grid.push(row);
        rowMeta.push({ type: 'block', label: override.label || 'W/C' });
        currentRowIndex++;
        continue;
      }

      if (override.type === 'bench') {
        const count = remainingSeats;
        const row: (string | null)[] = [];

        for (let c = 0; c < count; c++) {
          const letter = seatLabels[c] || String.fromCharCode(65 + c);
          row.push(`${currentRowIndex}${letter}`);
        }

        grid.push(row);
        rowMeta.push({ type: 'bench' });
        seatsGenerated += count;
        currentRowIndex++;
        continue;
      }

      if (override.type === 'asymmetric') {
        const leftCount = Math.min(override.leftSeats ?? aislePosition, aislePosition);
        const rightMax = seatsPerRow - aislePosition;
        const rightCount = Math.min(override.rightSeats ?? 0, rightMax);
        const row: (string | null)[] = [];

        for (let c = 0; c < seatsPerRow; c++) {
          if (c < aislePosition) {
            if (c < leftCount && seatsGenerated < capacity) {
              row.push(`${currentRowIndex}${seatLabels[c]}`);
              seatsGenerated++;
            } else {
              row.push(null);
            }
          } else {
            const rightIndex = c - aislePosition;
            if (rightIndex < rightCount && seatsGenerated < capacity) {
              row.push(`${currentRowIndex}${seatLabels[c]}`);
              seatsGenerated++;
            } else {
              row.push(null);
            }
          }
        }
        grid.push(row);
        rowMeta.push({ type: 'asymmetric' });
        currentRowIndex++;
        continue;
      }
    }

    // Standard uniform row
    const row: (string | null)[] = [];
    const countToGenerate = Math.min(remainingSeats, seatsPerRow);

    for (let c = 0; c < seatsPerRow; c++) {
      if (c < countToGenerate) {
        row.push(`${currentRowIndex}${seatLabels[c]}`);
        seatsGenerated++;
      } else {
        row.push(null);
      }
    }

    grid.push(row);
    rowMeta.push({ type: 'standard' });
    currentRowIndex++;
  }

  return {
    grid,
    rowMeta,
    preset,
    seatsPerRow,
    aislePosition,
    seatLabels,
    totalRows: grid.length,
    capacity,
  };
}
/**
 * Physical lengths. Everything internal is PDF points (72 per inch); the UI
 * speaks whatever unit the user picked and converts at the boundary.
 */

export const POINTS_PER_INCH = 72;

export type Unit = "in" | "cm" | "mm" | "pt";

export const UNITS: readonly Unit[] = ["in", "cm", "mm", "pt"];

const POINTS_PER_UNIT: Record<Unit, number> = {
  in: POINTS_PER_INCH,
  cm: POINTS_PER_INCH / 2.54,
  mm: POINTS_PER_INCH / 25.4,
  pt: 1,
};

export function toPoints(value: number, unit: Unit): number {
  return value * POINTS_PER_UNIT[unit];
}

export function fromPoints(points: number, unit: Unit): number {
  return points / POINTS_PER_UNIT[unit];
}

/** Round-trip-friendly display: trims float noise to 3 decimals. */
export function formatLength(points: number, unit: Unit): string {
  const value = fromPoints(points, unit);
  return `${Number(value.toFixed(3))}`;
}

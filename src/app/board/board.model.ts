export type Color = 'white' | 'black';

export interface Checker {
  id: number;
  color: Color;
}

/** Gde se kružić nalazi: na polju (1-24), na baru ili izbačen sa table. */
export type Location =
  | { kind: 'point'; index: number }
  | { kind: 'bar'; color: Color }
  | { kind: 'off'; color: Color };

export interface BoardState {
  /** points[1..24] - id-jevi kružića, prvi element je na dnu gomile. points[0] se ne koristi. */
  points: number[][];
  bar: Record<Color, number[]>;
  off: Record<Color, number[]>;
}

export interface Pose {
  x: number;
  y: number;
  /** 0 = leži na tabli, 1 = podignut (veća senka, malo veći) */
  lift: number;
  /** dodatno skaliranje (npr. mali "squash" pri spuštanju) */
  squash?: number;
}

/**
 * Standardna početna pozicija. Beli se kreće 24 -> 1 (kuća dole desno),
 * crni 1 -> 24 (kuća gore desno).
 */
export const INITIAL_SETUP: { point: number; color: Color; count: number }[] = [
  { point: 24, color: 'white', count: 2 },
  { point: 13, color: 'white', count: 5 },
  { point: 8, color: 'white', count: 3 },
  { point: 6, color: 'white', count: 5 },
  { point: 1, color: 'black', count: 2 },
  { point: 12, color: 'black', count: 5 },
  { point: 17, color: 'black', count: 3 },
  { point: 19, color: 'black', count: 5 },
];

export function createCheckers(): Checker[] {
  const checkers: Checker[] = [];
  for (let i = 0; i < 15; i++) checkers.push({ id: i, color: 'white' });
  for (let i = 0; i < 15; i++) checkers.push({ id: 15 + i, color: 'black' });
  return checkers;
}

export function emptyState(): BoardState {
  return {
    points: Array.from({ length: 25 }, () => []),
    bar: { white: [], black: [] },
    off: { white: [], black: [] },
  };
}

/** Svi kružići u kutiji za izbačene - odatle ih "intro" animacija raspoređuje. */
export function allOffState(checkers: Checker[]): BoardState {
  const s = emptyState();
  for (const c of checkers) s.off[c.color].push(c.id);
  return s;
}

export function initialState(checkers: Checker[]): BoardState {
  const s = emptyState();
  const pool: Record<Color, number[]> = {
    white: checkers.filter((c) => c.color === 'white').map((c) => c.id),
    black: checkers.filter((c) => c.color === 'black').map((c) => c.id),
  };
  for (const { point, color, count } of INITIAL_SETUP) {
    for (let i = 0; i < count; i++) s.points[point].push(pool[color].shift()!);
  }
  return s;
}

export function cloneState(s: BoardState): BoardState {
  return {
    points: s.points.map((p) => [...p]),
    bar: { white: [...s.bar.white], black: [...s.bar.black] },
    off: { white: [...s.off.white], black: [...s.off.black] },
  };
}

export function stackAt(s: BoardState, loc: Location): number[] {
  switch (loc.kind) {
    case 'point':
      return s.points[loc.index];
    case 'bar':
      return s.bar[loc.color];
    case 'off':
      return s.off[loc.color];
  }
}

export function sameLocation(a: Location, b: Location): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'point') return a.index === (b as { index: number }).index;
  return a.color === (b as { color: Color }).color;
}

export function locationOf(s: BoardState, id: number): Location | null {
  for (let i = 1; i <= 24; i++) if (s.points[i].includes(id)) return { kind: 'point', index: i };
  for (const color of ['white', 'black'] as Color[]) {
    if (s.bar[color].includes(id)) return { kind: 'bar', color };
    if (s.off[color].includes(id)) return { kind: 'off', color };
  }
  return null;
}

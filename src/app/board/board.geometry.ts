import { Color, Location } from './board.model';

/** Sve dimenzije su u SVG jedinicama (viewBox). */
export const G = {
  frame: 28,
  pointW: 70,
  barW: 72,
  dividerW: 22,
  trayW: 78,
  playH: 704,
  triangleH: 300,
  r: 31,
  spacing: 62,
  /** max rastojanje izmedju prvog i poslednjeg kružića u gomili */
  maxStack: 4 * 62,
  slabH: 15,
} as const;

export const LEFT_X = G.frame;
export const BAR_X = LEFT_X + 6 * G.pointW;
export const RIGHT_X = BAR_X + G.barW;
export const DIVIDER_X = RIGHT_X + 6 * G.pointW;
export const TRAY_X = DIVIDER_X + G.dividerW;
export const WIDTH = TRAY_X + G.trayW + G.frame;
export const TOP_Y = G.frame;
export const BOTTOM_Y = G.frame + G.playH;
export const HEIGHT = BOTTOM_Y + G.frame;
export const MID_Y = (TOP_Y + BOTTOM_Y) / 2;
export const BAR_CX = BAR_X + G.barW / 2;
export const TRAY_CX = TRAY_X + G.trayW / 2;

export function isTop(point: number): boolean {
  return point >= 13;
}

/** x koordinata centra polja 1-24 */
export function pointX(point: number): number {
  const w = G.pointW;
  if (point <= 6) return RIGHT_X + (6 - point) * w + w / 2;
  if (point <= 12) return LEFT_X + (12 - point) * w + w / 2;
  if (point <= 18) return LEFT_X + (point - 13) * w + w / 2;
  return RIGHT_X + (point - 19) * w + w / 2;
}

/** Trougao polja kao SVG path. */
export function trianglePath(point: number): string {
  const cx = pointX(point);
  const half = G.pointW / 2 - 2;
  if (isTop(point)) {
    return `M ${cx - half} ${TOP_Y} L ${cx + half} ${TOP_Y} L ${cx} ${TOP_Y + G.triangleH} Z`;
  }
  return `M ${cx - half} ${BOTTOM_Y} L ${cx + half} ${BOTTOM_Y} L ${cx} ${BOTTOM_Y - G.triangleH} Z`;
}

function stackStep(count: number, base = G.spacing, max = G.maxStack): number {
  return count > 1 ? Math.min(base, max / (count - 1)) : base;
}

/** Pozicija (centar) kružića `index` u gomili od `count` na datoj lokaciji. */
export function checkerXY(loc: Location, index: number, count: number): { x: number; y: number } {
  switch (loc.kind) {
    case 'point': {
      const step = stackStep(count);
      const x = pointX(loc.index);
      return isTop(loc.index)
        ? { x, y: TOP_Y + G.r + 2 + index * step }
        : { x, y: BOTTOM_Y - G.r - 2 - index * step };
    }
    case 'bar': {
      // beli na baru stoje u donjoj polovini, crni u gornjoj, gomila ide od centra ka ivici
      const step = stackStep(count, G.spacing, 230);
      const start = 52;
      return loc.color === 'white'
        ? { x: BAR_CX, y: MID_Y + start + index * step }
        : { x: BAR_CX, y: MID_Y - start - index * step };
    }
    case 'off': {
      // izbačeni kružići leže "na boku" u kutiji desno: beli dole, crni gore
      const step = G.slabH + 3;
      return loc.color === 'white'
        ? { x: TRAY_CX, y: BOTTOM_Y - 10 - G.slabH / 2 - index * step }
        : { x: TRAY_CX, y: TOP_Y + 10 + G.slabH / 2 + index * step };
    }
  }
}

/** Koja lokacija je ispod tačke (x, y) - za drag & drop i klik na polje. */
export function locationAt(x: number, y: number, color: Color): Location | null {
  if (x >= TRAY_X && x <= TRAY_X + G.trayW && y >= TOP_Y && y <= BOTTOM_Y) {
    return { kind: 'off', color };
  }
  if (x >= BAR_X && x < RIGHT_X && y >= TOP_Y && y <= BOTTOM_Y) {
    return { kind: 'bar', color };
  }
  if (y < TOP_Y || y > BOTTOM_Y) return null;
  const top = y < MID_Y;
  if (x >= LEFT_X && x < BAR_X) {
    const col = Math.floor((x - LEFT_X) / G.pointW);
    return { kind: 'point', index: top ? 13 + col : 12 - col };
  }
  if (x >= RIGHT_X && x < DIVIDER_X) {
    const col = Math.floor((x - RIGHT_X) / G.pointW);
    return { kind: 'point', index: top ? 19 + col : 6 - col };
  }
  return null;
}

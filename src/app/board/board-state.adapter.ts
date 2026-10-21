import { GameStateJson } from '../models/game-state';
import { BoardState, Color, Location, emptyState } from './board.model';

const BAR = 0;
const OFF = 25;

export function toBoardState(state: GameStateJson): BoardState {
  const board = emptyState();
  const nextId: Record<Color, number> = { white: 0, black: 15 };
  const take = (color: Color, count: number): number[] => {
    const ids: number[] = [];
    for (let i = 0; i < count; i++) ids.push(nextId[color]++);
    return ids;
  };

  for (let p = 1; p <= 24; p++) {
    const n = state.points[p];
    if (n > 0) board.points[p] = take('white', n);
    else if (n < 0) board.points[p] = take('black', -n);
  }
  board.bar.white = take('white', state.whiteBar);
  board.bar.black = take('black', state.blackBar);
  board.off.white = take('white', state.whiteOff);
  board.off.black = take('black', state.blackOff);
  return board;
}

export function toBackendPosition(loc: Location): number {
  switch (loc.kind) {
    case 'point':
      return loc.index;
    case 'bar':
      return BAR;
    case 'off':
      return OFF;
  }
}

/** color = boja igrača koji igra potez. */
export function fromBackendPosition(pos: number, color: Color): Location {
  if (pos === BAR) return { kind: 'bar', color };
  if (pos === OFF) return { kind: 'off', color };
  return { kind: 'point', index: pos };
}

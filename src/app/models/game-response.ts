import { GameStateJson } from './game-state';

export type GameStatus = 'IN_PROGRESS' | 'FINISHED' | 'ABANDONED';

export interface GameResponse {
  id: number;
  roomId: number;
  status: GameStatus;
  currentTurnUserId: number | null;
  currentState: GameStateJson;
  turnNumber: number;
  startedAt: string;
  finishedAt: string | null;
  openingWhiteDie: number | null;
  openingBlackDie: number | null;
}

export type GameStatus = 'IN_PROGRESS' | 'FINISHED' | 'ABANDONED';

export interface GameResponse {
  id: number;
  roomId: number;
  status: GameStatus;
  currentTurnUserId: number | null;
  turnNumber: number;
  startedAt: string;
  finishedAt: string | null;
}

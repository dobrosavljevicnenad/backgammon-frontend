export interface MoveResponse {
  id: number;
  gameId: number;
  gamePlayerId: number;
  turnNumber: number;
  moveNumber: number;
  fromPosition: number;
  toPosition: number;
  diceValue: number;
  createdAt: string;
}
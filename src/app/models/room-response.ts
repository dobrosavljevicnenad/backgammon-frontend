export type RoomStatus = 'WAITING' | 'PLAYING' | 'CLOSED';

export interface RoomResponse {
  id: number;
  name: string;
  status: RoomStatus;
  playerCount: number;
  createdAt: string;
  gameId: number | null;
}

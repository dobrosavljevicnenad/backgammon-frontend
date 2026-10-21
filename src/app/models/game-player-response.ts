export interface GamePlayerResponse {
  id: number;
  gameId: number;
  userId: number;
  username: string;
  color: 'WHITE' | 'BLACK';
  winner: boolean;
}

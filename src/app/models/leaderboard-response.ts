import { LeaderboardEntryResponse } from './leaderboard-entry-response';

export interface LeaderboardResponse {
  entries: LeaderboardEntryResponse[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

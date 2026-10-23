import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { LeaderboardEntryResponse } from '../models/leaderboard-entry-response';
import { LeaderboardResponse } from '../models/leaderboard-response';

@Injectable({
  providedIn: 'root'
})
export class LeaderboardService {

  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/api/leaderboard`;

  getLeaderboard(page: number, size: number): Observable<LeaderboardResponse> {
    return this.http.get<LeaderboardResponse>(this.baseUrl, { params: { page, size } });
  }

  /** Backend answers 404 when the user is not ranked. */
  getCurrentPlayer(): Observable<LeaderboardEntryResponse> {
    return this.http.get<LeaderboardEntryResponse>(`${this.baseUrl}/me`);
  }
}

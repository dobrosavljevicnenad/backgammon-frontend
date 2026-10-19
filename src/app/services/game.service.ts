import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { GameResponse } from '../models/game-response';

@Injectable({
  providedIn: 'root'
})
export class GameService {

  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/api/games`;

  startGame(roomId: number): Observable<GameResponse> {
    return this.http.post<GameResponse>(`${this.baseUrl}/rooms/${roomId}/start`, null);
  }

  finishGame(gameId: number): Observable<GameResponse> {
    return this.http.post<GameResponse>(`${this.baseUrl}/${gameId}/finish`, null);
  }
}

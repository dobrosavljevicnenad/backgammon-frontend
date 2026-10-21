import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { GameResponse } from '../models/game-response';
import { MoveResponse } from '../models/move-response';
import { GamePlayerResponse } from '../models/game-player-response';
import { LegalMoveResponse } from '../models/legal-move-response';
import { MakeMoveRequest } from '../models/make-move-request';

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

  getMoves(gameId: number): Observable<MoveResponse[]> {
    return this.http.get<MoveResponse[]>(`${this.baseUrl}/${gameId}/moves`);
  }

  getGame(gameId: number): Observable<GameResponse> {
    return this.http.get<GameResponse>(`${this.baseUrl}/${gameId}`);
  }

  getPlayers(gameId: number): Observable<GamePlayerResponse[]> {
    return this.http.get<GamePlayerResponse[]>(`${this.baseUrl}/${gameId}/players`);
  }

  roll(gameId: number): Observable<GameResponse> {
    return this.http.post<GameResponse>(`${this.baseUrl}/${gameId}/roll`, null);
  }

  getLegalMoves(gameId: number): Observable<LegalMoveResponse[]> {
    return this.http.get<LegalMoveResponse[]>(`${this.baseUrl}/${gameId}/legal-moves`);
  }

  makeMove(gameId: number, move: MakeMoveRequest): Observable<GameResponse> {
    return this.http.post<GameResponse>(`${this.baseUrl}/${gameId}/moves`, move);
  }
}

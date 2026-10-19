import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { RoomPlayerResponse } from '../models/room-player-response';
import { RoomResponse } from '../models/room-response';

@Injectable({
  providedIn: 'root'
})
export class RoomService {

  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/api/rooms`;

  getWaitingRooms(): Observable<RoomResponse[]> {
    return this.http.get<RoomResponse[]>(`${this.baseUrl}/waiting`);
  }

  /** The user's WAITING/PLAYING room, or null (backend answers 204 when there is none). */
  getCurrentRoom(): Observable<RoomResponse | null> {
    return this.http
      .get<RoomResponse>(`${this.baseUrl}/current`, { observe: 'response' })
      .pipe(map((response) => response.status === 204 ? null : response.body));
  }

  getRoom(roomId: number): Observable<RoomResponse> {
    return this.http.get<RoomResponse>(`${this.baseUrl}/${roomId}`);
  }

  getPlayers(roomId: number): Observable<RoomPlayerResponse[]> {
    return this.http.get<RoomPlayerResponse[]>(`${this.baseUrl}/${roomId}/players`);
  }

  createRoom(name: string): Observable<RoomResponse> {
    return this.http.post<RoomResponse>(this.baseUrl, { name });
  }

  joinRoom(roomId: number): Observable<RoomPlayerResponse> {
    return this.http.post<RoomPlayerResponse>(`${this.baseUrl}/${roomId}/join`, null);
  }

  leaveRoom(roomId: number): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${roomId}/leave`, null);
  }
}

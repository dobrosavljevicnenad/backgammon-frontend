import { Injectable, inject } from '@angular/core';
import { Client, IMessage, StompSubscription } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { GameResponse } from '../models/game-response';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class GameSocketService {

  private readonly auth = inject(AuthService);

  /** Svako stanje igre koje backend pošalje na /topic/games/{gameId}. Unsubscribe gasi konekciju. */
  watchGame(gameId: number): Observable<GameResponse> {
    return new Observable<GameResponse>((subscriber) => {
      let subscription: StompSubscription | undefined;

      const client = new Client({
        webSocketFactory: () => new SockJS(`${environment.apiUrl}/ws`),
        connectHeaders: { Authorization: `Bearer ${this.auth.token() ?? ''}` },
        reconnectDelay: 3000,
        onConnect: () => {
          subscription = client.subscribe(`/topic/games/${gameId}`, (message: IMessage) => {
            subscriber.next(JSON.parse(message.body) as GameResponse);
          });
        },
        onStompError: (frame) => {
          console.error('STOMP greška', frame.headers['message']);
        }
      });

      client.activate();

      return () => {
        subscription?.unsubscribe();
        void client.deactivate();
      };
    });
  }
}

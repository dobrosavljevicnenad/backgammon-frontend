import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, forkJoin, interval } from 'rxjs';
import { apiErrorMessage } from '../../auth/api-error';
import { RoomPlayerResponse } from '../../models/room-player-response';
import { RoomResponse } from '../../models/room-response';
import { AuthService } from '../../services/auth.service';
import { GameService } from '../../services/game.service';
import { RoomService } from '../../services/room.service';

const POLL_INTERVAL_MS = 2000;
const PLAYERS_NEEDED = 2;

@Component({
  selector: 'app-waiting-room',
  standalone: true,
  templateUrl: './waiting-room.html',
  styleUrl: './waiting-room.scss',
})
export class WaitingRoom implements OnInit {

  private readonly authService = inject(AuthService);
  private readonly roomService = inject(RoomService);
  private readonly gameService = inject(GameService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  private readonly roomId = Number(this.route.snapshot.paramMap.get('id'));

  readonly room = signal<RoomResponse | null>(null);
  readonly players = signal<RoomPlayerResponse[]>([]);
  readonly errorMessage = signal('');
  readonly busy = signal(false);

  readonly isHost = computed(() => {
    const me = this.authService.username();
    return this.players().some((player) => player.host && player.username === me);
  });
  readonly canStart = computed(() => this.isHost() && this.players().length === PLAYERS_NEEDED);

  ngOnInit(): void {
    this.refresh();
    interval(POLL_INTERVAL_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.refresh());
  }

  refresh(): void {
    forkJoin({
      room: this.roomService.getRoom(this.roomId),
      players: this.roomService.getPlayers(this.roomId)
    }).subscribe({
      next: ({ room, players }) => {
        this.room.set(room);
        this.players.set(players);
        if (room.status === 'PLAYING' && room.gameId !== null) {
          this.goToBoard(room.gameId);
        } else if (room.status === 'CLOSED') {
          void this.router.navigate(['/lobby']);
        }
      },
      error: (error: HttpErrorResponse) => {
        if (error.status === 404) {
          void this.router.navigate(['/lobby']);
          return;
        }
        this.errorMessage.set(apiErrorMessage(error, 'Could not load room.'));
      }
    });
  }

  start(): void {
    this.runAction(this.gameService.startGame(this.roomId), 'Could not start game.', (game) => {
      this.goToBoard(game.id);
    });
  }

  leave(): void {
    this.runAction(this.roomService.leaveRoom(this.roomId), 'Could not leave room.', () => {
      void this.router.navigate(['/lobby']);
    });
  }

  private goToBoard(gameId: number): void {
    void this.router.navigate(['/board'], { queryParams: { gameId } });
  }

  private runAction<T>(request: Observable<T>, fallback: string, onSuccess: (value: T) => void): void {
    this.errorMessage.set('');
    this.busy.set(true);
    request.subscribe({
      next: (value) => {
        this.busy.set(false);
        onSuccess(value);
      },
      error: (error: HttpErrorResponse) => {
        this.busy.set(false);
        this.errorMessage.set(apiErrorMessage(error, fallback));
      }
    });
  }
}

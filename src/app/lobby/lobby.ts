import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Observable, interval } from 'rxjs';
import { RoomResponse } from '../models/room-response';
import { AuthService } from '../services/auth.service';
import { GameService } from '../services/game.service';
import { RoomService } from '../services/room.service';
import { apiErrorMessage } from '../auth/api-error';

const POLL_INTERVAL_MS = 3000;
const MAX_PLAYERS = 2;

@Component({
  selector: 'app-lobby',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './lobby.html',
  styleUrl: './lobby.scss',
})
export class Lobby implements OnInit {

  private readonly authService = inject(AuthService);
  private readonly roomService = inject(RoomService);
  private readonly gameService = inject(GameService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly username = this.authService.username;
  readonly currentRoom = signal<RoomResponse | null>(null);
  readonly waitingRooms = signal<RoomResponse[]>([]);
  readonly errorMessage = signal('');
  readonly busy = signal(false);
  roomName = '';

 showCreateModal = false;
showJoinModal = false;

  ngOnInit(): void {
    this.refresh();
    interval(POLL_INTERVAL_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.refresh());
  }

  refresh(): void {
    this.roomService.getCurrentRoom().subscribe({
      next: (room) => this.currentRoom.set(room),
      error: (error: HttpErrorResponse) => this.showError(error, 'Could not load your room.')
    });
    this.roomService.getWaitingRooms().subscribe({
      next: (rooms) => this.waitingRooms.set(rooms),
      error: (error: HttpErrorResponse) => this.showError(error, 'Could not load rooms.')
    });
  }

  createRoom(): void {
    const name = this.roomName.trim();
    if (!name) {
      this.errorMessage.set('Room name is required.');
      return;
    }
    this.runAction(this.roomService.createRoom(name), 'Could not create room.', (room) => {
      void this.router.navigate(['/room', room.id]);
    });
  }

  joinRoom(room: RoomResponse): void {
    this.runAction(this.roomService.joinRoom(room.id), 'Could not join room.', () => {
      void this.router.navigate(['/room', room.id]);
    });
  }

  openCurrentRoom(room: RoomResponse): void {
    if (room.status === 'PLAYING' && room.gameId !== null) {
      void this.router.navigate(['/board'], { queryParams: { gameId: room.gameId } });
      return;
    }
    void this.router.navigate(['/room', room.id]);
  }

  finishGame(room: RoomResponse): void {
    if (room.gameId === null) {
      return;
    }
    this.runAction(this.gameService.finishGame(room.gameId), 'Could not end game.', () => {
      this.refresh();
    });
  }

  canJoin(room: RoomResponse): boolean {
    return this.currentRoom() === null && room.playerCount < MAX_PLAYERS && room.status === 'WAITING';
  }

  openLeaderboard(): void {
    void this.router.navigate(['/leaderboard']);
  }

  logout(): void {
    this.authService.logout();
    void this.router.navigate(['/login']);
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
        this.showError(error, fallback);
        this.refresh();
      }
    });
  }

  private showError(error: HttpErrorResponse, fallback: string): void {
    this.errorMessage.set(apiErrorMessage(error, fallback));
  }
}

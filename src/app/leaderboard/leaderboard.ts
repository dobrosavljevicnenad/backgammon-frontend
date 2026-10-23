import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { LeaderboardEntryResponse } from '../models/leaderboard-entry-response';
import { AuthService } from '../services/auth.service';
import { LeaderboardService } from '../services/leaderboard.service';
import { apiErrorMessage } from '../auth/api-error';

const PAGE_SIZE = 20;

@Component({
  selector: 'app-leaderboard',
  standalone: true,
  templateUrl: './leaderboard.html',
  styleUrl: './leaderboard.scss',
})
export class Leaderboard implements OnInit {

  private readonly authService = inject(AuthService);
  private readonly leaderboardService = inject(LeaderboardService);
  private readonly router = inject(Router);

  readonly username = this.authService.username;
  readonly entries = signal<LeaderboardEntryResponse[]>([]);
  readonly me = signal<LeaderboardEntryResponse | null>(null);
  readonly page = signal(0);
  readonly totalPages = signal(0);
  readonly errorMessage = signal('');

  readonly hasPrevious = computed(() => this.page() > 0);
  readonly hasNext = computed(() => this.page() + 1 < this.totalPages());

  ngOnInit(): void {
    this.loadCurrentPlayer();
    this.loadPage(0);
  }

  loadPage(page: number): void {
    this.leaderboardService.getLeaderboard(page, PAGE_SIZE).subscribe({
      next: (response) => {
        this.errorMessage.set('');
        this.entries.set(response.entries);
        this.page.set(response.page);
        this.totalPages.set(response.totalPages);
      },
      error: (error: HttpErrorResponse) => {
        this.errorMessage.set(apiErrorMessage(error, 'Could not load leaderboard.'));
      }
    });
  }

  isCurrentUser(entry: LeaderboardEntryResponse): boolean {
    return entry.username === this.username();
  }

  back(): void {
    void this.router.navigate(['/lobby']);
  }

  private loadCurrentPlayer(): void {
    this.leaderboardService.getCurrentPlayer().subscribe({
      next: (entry) => this.me.set(entry),
      error: () => this.me.set(null)
    });
  }
}

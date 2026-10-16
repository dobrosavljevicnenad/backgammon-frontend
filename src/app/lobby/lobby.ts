import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { inject } from '@angular/core';

@Component({
  selector: 'app-lobby',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './lobby.html',
  styleUrl: './lobby.scss'
})
export class Lobby {
   private readonly authService = inject(AuthService);

  readonly username = this.authService.username;
showCreateGame=false;
roomName='';
  constructor(private router: Router) {}

  createGame(): void {
    this.router.navigate(['/board']);
  }
  openCreateGame(): void {
  this.showCreateGame = true;
}
closeCreateGame(): void {
  this.showCreateGame = false;
}
createRoom(): void {

  if (!this.roomName.trim()) {
    return;
  }

  console.log('Game name:', this.roomName);

  this.router.navigate(['/board']);
}

logout(): void {
  this.authService.logout();
  void this.router.navigate(['/login']);
}
}
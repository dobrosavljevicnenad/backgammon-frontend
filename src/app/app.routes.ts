import { Routes } from '@angular/router';
import { Login } from './auth/login/login';
import { Register } from './auth/register/register';
import { BoardComponent } from './board/board.component';
import { Lobby } from './lobby/lobby';
import { Leaderboard } from './leaderboard/leaderboard';
import { WaitingRoom } from './room/waiting-room/waiting-room';
import { authGuard, guestGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },
  {
    path: 'login',
    component: Login,
    canActivate: [guestGuard]
  },
  {
    path: 'register',
    component: Register,
    canActivate: [guestGuard]
  },
  {
    path: 'lobby',
    component: Lobby,
    canActivate: [authGuard]
  },
  {
    path: 'leaderboard',
    component: Leaderboard,
    canActivate: [authGuard]
  },
  {
    path: 'room/:id',
    component: WaitingRoom,
    canActivate: [authGuard]
  },
  {
    path: 'board',
    component: BoardComponent,
    canActivate: [authGuard]
  },
  {
    path: '**',
    redirectTo: 'login'
  }
];

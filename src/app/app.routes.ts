import { Routes } from '@angular/router';
import { Login } from './auth/login/login';
import { Register } from './auth/register/register';
import { BoardComponent } from './board/board.component';
import {Lobby} from './lobby/lobby';
export const routes: Routes = [
  { path: '',
    redirectTo: 'login',
    pathMatch: 'full'
    },
  { 
    path: 'login', 
    component: Login
},
  { 
    path: 'register',
     component: Register
},
{
    path: 'board',
    component: BoardComponent
},
{
    path: 'lobby',
    component: Lobby
}
];
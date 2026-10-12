import { Injectable } from '@angular/core';
import { LoginRequest } from '../models/login-request';
import { RegisterRequest } from '../models/register-request';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  login(request: LoginRequest): void {
    console.log('LOGIN REQUEST', request);
  }

  register(request: RegisterRequest): void {
    console.log('REGISTER REQUEST', request);
  }

}
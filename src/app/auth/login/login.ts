import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { LoginRequest } from '../../models/login-request';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {

  username = '';
  password = '';
  errorMessage = '';

  constructor(private authService: AuthService) {}

  login(): void {
if (!this.username || !this.password) {
  this.errorMessage = 'Username and password are required.';
  return;
}
 this.errorMessage = '';
 
    const request: LoginRequest = {
      username: this.username,
      password: this.password
    };

    this.authService.login(request);
  }
}
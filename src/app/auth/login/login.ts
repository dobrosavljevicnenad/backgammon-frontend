import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { Router, RouterLink } from '@angular/router';
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

  constructor(private authService: AuthService, private router: Router) {}

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
this.router.navigate(['/lobby']);
  }
}
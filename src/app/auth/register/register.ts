import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { RegisterRequest } from '../../models/register-request';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: './register.scss',
})
export class Register {

  username = '';
  email = '';
  password = '';
  confirmPassword = '';
  errorMessage = '';

  constructor(private authService: AuthService) {}

  register(): void {
if (
  !this.username ||
  !this.email ||
  !this.password ||
  !this.confirmPassword
) {
  this.errorMessage = 'All fields are required.';
  return;
}
if (this.password !== this.confirmPassword) {
  this.errorMessage = 'Passwords do not match.';
  return;
}
this.errorMessage = '';
    const request: RegisterRequest = {
      username: this.username,
      email: this.email,
      password: this.password
    };

    this.authService.register(request);
  }
}
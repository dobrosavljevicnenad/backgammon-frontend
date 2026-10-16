import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthResponse } from '../models/auth-response';
import { LoginRequest } from '../models/login-request';
import { RegisterRequest } from '../models/register-request';
import { UserResponse } from '../models/user-response';

const TOKEN_KEY = 'bg_token';
const USERNAME_KEY = 'bg_username';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/auth`;

  private readonly tokenSignal = signal<string | null>(readStorage(TOKEN_KEY));
  readonly username = signal<string | null>(readStorage(USERNAME_KEY));
  readonly isLoggedIn = computed(() => {
    const token = this.tokenSignal();
    return token !== null && !isExpired(token);
  });

  login(request: LoginRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.baseUrl}/login`, request)
      .pipe(tap((response) => this.saveSession(response)));
  }

  register(request: RegisterRequest): Observable<UserResponse> {
    return this.http.post<UserResponse>(`${this.baseUrl}/register`, request);
  }

  me(): Observable<UserResponse> {
    return this.http.get<UserResponse>(`${this.baseUrl}/me`);
  }

  /** Token for the Authorization header, or null when missing/expired. */
  token(): string | null {
    return this.isLoggedIn() ? this.tokenSignal() : null;
  }

  logout(): void {
    removeStorage(TOKEN_KEY);
    removeStorage(USERNAME_KEY);
    this.tokenSignal.set(null);
    this.username.set(null);
  }

  private saveSession(response: AuthResponse): void {
    writeStorage(TOKEN_KEY, response.token);
    writeStorage(USERNAME_KEY, response.username);
    this.tokenSignal.set(response.token);
    this.username.set(response.username);
  }

}

/** Reads the `exp` claim (seconds) from the JWT payload. The backend still validates the token. */
function isExpired(token: string): boolean {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const { exp } = JSON.parse(atob(payload)) as { exp?: number };
    return exp !== undefined && exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}

// localStorage can throw (private mode, blocked storage), so access is wrapped.
function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // session then lives only in memory
  }
}

function removeStorage(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // nothing to remove
  }
}

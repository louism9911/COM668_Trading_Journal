import { Injectable } from '@angular/core';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  constructor(private router: Router) {}

  // Store the token and user info after login
  setSession(token: string, username: string, userId: string, admin: boolean) {
    sessionStorage.setItem('token', token);
    sessionStorage.setItem('username', username);
    sessionStorage.setItem('user_id', userId);
    sessionStorage.setItem('admin', String(admin));
  }

  // Clear session data on logout
  clearSession() {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('username');
    sessionStorage.removeItem('user_id');
    sessionStorage.removeItem('admin');
  }

  // Check if a user is currently logged in
  isLoggedIn(): boolean {
    return sessionStorage.getItem('token') !== null;
  }

  // Get the stored username
  getUsername(): string {
    return sessionStorage.getItem('username') || '';
  }

  // Get the stored user ID
  getUserId(): string {
    return sessionStorage.getItem('user_id') || '';
  }

  // Check if the logged-in user is an admin
  isAdmin(): boolean {
    return sessionStorage.getItem('admin') === 'true';
  }

  // Redirect to login page
  redirectToLogin() {
    this.router.navigate(['/login']);
  }
}

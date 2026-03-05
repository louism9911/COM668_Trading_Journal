import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { WebService } from '../../services/web-service';
import { AuthService } from '../../services/auth-service';

@Component({
  selector: 'app-account',
  imports: [CommonModule, FormsModule],
  providers: [WebService],
  templateUrl: './account.html'
})
export class Account implements OnInit {

  // Change username form
  newUsername: string      = '';
  usernameSuccess: string  = '';
  usernameError: string    = '';
  isSavingUsername: boolean = false;

  // Change password form
  currentPassword: string  = '';
  newPassword: string      = '';
  confirmPassword: string  = '';
  passwordSuccess: string  = '';
  passwordError: string    = '';
  isSavingPassword: boolean = false;

  // Delete account
  isDeleting: boolean  = false;
  deleteError: string  = '';

  constructor(
    private webService: WebService,
    protected authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/login']);
    }
  }

  // ─── Username ──────────────────────────────────────────

  get canSubmitUsername(): boolean {
    return this.newUsername.trim().length >= 3;
  }

  changeUsername() {
    this.usernameSuccess  = '';
    this.usernameError    = '';
    this.isSavingUsername = true;

    this.webService.updateAccount({ new_username: this.newUsername.trim() }).subscribe({
      next: (res: any) => {
        sessionStorage.setItem('username', res.username);
        this.usernameSuccess  = 'Username updated successfully.';
        this.newUsername      = '';
        this.isSavingUsername = false;
      },
      error: (err: any) => {
        this.usernameError    = err.error?.error || 'Failed to update username.';
        this.isSavingUsername = false;
      }
    });
  }

  // ─── Password ──────────────────────────────────────────

  get passwordMismatch(): boolean {
    return !!(this.newPassword && this.confirmPassword && this.newPassword !== this.confirmPassword);
  }

  get canSubmitPassword(): boolean {
    return !!(this.currentPassword && this.newPassword && this.confirmPassword &&
              !this.passwordMismatch && this.newPassword.length >= 6);
  }

  changePassword() {
    this.passwordSuccess  = '';
    this.passwordError    = '';
    this.isSavingPassword = true;

    this.webService.updateAccount({
      current_password: this.currentPassword,
      new_password:     this.newPassword
    }).subscribe({
      next: () => {
        this.passwordSuccess  = 'Password updated successfully.';
        this.currentPassword  = '';
        this.newPassword      = '';
        this.confirmPassword  = '';
        this.isSavingPassword = false;
      },
      error: (err: any) => {
        this.passwordError    = err.error?.error || 'Failed to update password.';
        this.isSavingPassword = false;
      }
    });
  }

  // ─── Delete ────────────────────────────────────────────

  deleteAccount() {
    if (!confirm(
      `Are you sure you want to permanently delete your account?\n\n` +
      `This will delete all your trades and cannot be undone.`
    )) return;

    this.isDeleting  = true;
    this.deleteError = '';

    this.webService.deleteMyAccount().subscribe({
      next: () => {
        this.authService.clearSession();
        this.router.navigate(['/login']);
      },
      error: () => {
        this.isDeleting  = false;
        this.deleteError = 'Failed to delete account. Please try again.';
      }
    });
  }
}

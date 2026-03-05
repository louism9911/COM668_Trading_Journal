import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { WebService } from '../../services/web-service';
import { AuthService } from '../../services/auth-service';

@Component({
  selector: 'app-admin',
  imports: [CommonModule],
  providers: [WebService],
  templateUrl: './admin.html'
})
export class Admin implements OnInit {

  users: any[] = [];
  isLoading: boolean = true;
  errorMessage: string = '';
  deletingId: string = '';

  constructor(
    private webService: WebService,
    protected authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    if (!this.authService.isLoggedIn() || !this.authService.isAdmin()) {
      this.router.navigate(['/']);
      return;
    }
    this.loadUsers();
  }

  loadUsers() {
    this.isLoading = true;
    this.webService.getAdminUsers().subscribe({
      next: (response: any) => {
        this.users = response;
        this.isLoading = false;
      },
      error: () => {
        this.errorMessage = 'Failed to load users.';
        this.isLoading = false;
      }
    });
  }

  deleteUser(user: any) {
    if (!confirm(
      `Delete user "${user.username}"?\n\n` +
      `This will permanently remove their account and all ${user.trade_count} trades.`
    )) return;

    this.deletingId = user.user_id;
    this.webService.adminDeleteUser(user.user_id).subscribe({
      next: () => {
        this.deletingId = '';
        this.users = this.users.filter(u => u.user_id !== user.user_id);
      },
      error: () => {
        this.deletingId = '';
        this.errorMessage = `Failed to delete user "${user.username}".`;
      }
    });
  }

  isCurrentUser(userId: string): boolean {
    return userId === this.authService.getUserId();
  }
}

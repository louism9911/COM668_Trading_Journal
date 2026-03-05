import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth-service';
import { WebService } from '../../services/web-service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-navigation',
  imports: [RouterModule],
  providers: [WebService],
  templateUrl: './navigation.html',
  styleUrl: './navigation.css'
})
export class Navigation {

  constructor(
    protected authService: AuthService,
    private webService: WebService,
    private router: Router
  ) {}

  // Handle logout - calls API then clears session
  onLogout() {
    this.webService.logout().subscribe({
      next: (response: any) => {
        this.authService.clearSession();
        this.router.navigate(['/login']);
      },
      error: (error: any) => {
        // Clear session even if API call fails
        this.authService.clearSession();
        this.router.navigate(['/login']);
      }
    });
  }
}

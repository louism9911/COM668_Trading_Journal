import { Component } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { WebService } from '../../services/web-service';
import { AuthService } from '../../services/auth-service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, CommonModule, RouterModule],
  providers: [WebService],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login {

  loginForm: any;
  errorMessage: string = '';
  sessionExpired: boolean = false;

  constructor(
    private formBuilder: FormBuilder,
    private webService: WebService,
    protected authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    // Redirect if already logged in
    if (this.authService.isLoggedIn()) {
      this.router.navigate(['/']);
    }

    // Show session-expired banner if redirected by the auth interceptor
    this.sessionExpired = this.route.snapshot.queryParamMap.get('expired') === 'true';

    // Build the login form with validation
    this.loginForm = this.formBuilder.group({
      username: ['', Validators.required],
      password: ['', Validators.required]
    });
  }

  // Check if a form field is invalid and has been touched
  isInvalid(control: string) {
    return this.loginForm.controls[control].invalid &&
           this.loginForm.controls[control].touched;
  }

  // Check if the form is incomplete
  isIncomplete() {
    return this.loginForm.invalid;
  }

  // Handle form submission
  onSubmit() {
    this.errorMessage = '';

    this.webService.login(
      this.loginForm.value.username,
      this.loginForm.value.password
    ).subscribe({
      next: (response: any) => {
        // Store token and user info in sessionStorage
        this.authService.setSession(
          response.token,
          response.username,
          response.user_id,
          response.admin
        );
        // Navigate to the home page
        this.router.navigate(['/']);
      },
      error: (error: any) => {
        if (error.status === 401) {
          this.errorMessage = 'Invalid username or password';
        } else {
          this.errorMessage = 'Login failed. Please try again.';
        }
      }
    });
  }
}

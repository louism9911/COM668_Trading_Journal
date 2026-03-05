import { Component } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { WebService } from '../../services/web-service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, CommonModule, RouterModule],
  providers: [WebService],
  templateUrl: './register.html',
  styleUrl: './register.css'
})
export class Register {

  registerForm: any;
  errorMessage: string = '';
  successMessage: string = '';

  constructor(
    private formBuilder: FormBuilder,
    private webService: WebService,
    private router: Router
  ) {}

  ngOnInit() {
    // Build the registration form with validation
    this.registerForm = this.formBuilder.group({
      username: ['', Validators.required],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required]
    });
  }

  // Check if a form field is invalid and has been touched
  isInvalid(control: string) {
    return this.registerForm.controls[control].invalid &&
           this.registerForm.controls[control].touched;
  }

  // Check if the form is incomplete
  isIncomplete() {
    return this.registerForm.invalid;
  }

  // Check if passwords match
  passwordsMatch() {
    return this.registerForm.value.password ===
           this.registerForm.value.confirmPassword;
  }

  // Handle form submission
  onSubmit() {
    this.errorMessage = '';
    this.successMessage = '';

    // Check passwords match before submitting
    if (!this.passwordsMatch()) {
      this.errorMessage = 'Passwords do not match';
      return;
    }

    this.webService.register(
      this.registerForm.value.username,
      this.registerForm.value.password
    ).subscribe({
      next: (response: any) => {
        this.successMessage = 'Account created successfully! Redirecting to login...';
        // Redirect to login after short delay
        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 1500);
      },
      error: (error: any) => {
        if (error.status === 409) {
          this.errorMessage = 'Username already exists';
        } else if (error.status === 400) {
          this.errorMessage = 'Please provide a valid username and password';
        } else {
          this.errorMessage = 'Registration failed. Please try again.';
        }
      }
    });
  }
}

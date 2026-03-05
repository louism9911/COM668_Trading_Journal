import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, ValidationErrors, ValidatorFn, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { WebService } from '../../services/web-service';
import { AuthService } from '../../services/auth-service';

// Validator: selected datetime must not be in the future
function notFutureDate(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (!control.value) return null;
    return new Date(control.value) > new Date() ? { futureDate: true } : null;
  };
}

// Cross-field validator: close_time must not be before open_time
function closeAfterOpen(group: AbstractControl): ValidationErrors | null {
  const open = group.get('open_time')?.value;
  const close = group.get('close_time')?.value;
  if (open && close && new Date(close) < new Date(open)) {
    return { closeBeforeOpen: true };
  }
  return null;
}

@Component({
  selector: 'app-add-trade',
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  providers: [WebService],
  templateUrl: './add-trade.html',
  styleUrl: './add-trade.css'
})
export class AddTrade {

  tradeForm: any;
  errorMessage: string = '';
  successMessage: string = '';

  constructor(
    private formBuilder: FormBuilder,
    private webService: WebService,
    private authService: AuthService,
    private router: Router
  ) {}

  // Returns current local datetime formatted for datetime-local max attribute
  get maxDateTime(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${mins}`;
  }

  ngOnInit() {
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/login']);
      return;
    }

    // Build trade form matching backend fields
    this.tradeForm = this.formBuilder.group({
      symbol:      ['', Validators.required],
      type:        ['buy', Validators.required],
      lots:        [0.01, [Validators.required, Validators.min(0.01)]],
      open_price:  [0, Validators.required],
      close_price: [0, Validators.required],
      open_time:   ['', notFutureDate()],
      close_time:  ['', notFutureDate()],
      profit:      [0, Validators.required],
      commission:  [0],
      swap:        [0],
      sl:          [0],
      tp:          [0],
      ticket:      ['']
    }, { validators: closeAfterOpen });
  }

  // Check if a form field is invalid and has been touched
  isInvalid(control: string) {
    return this.tradeForm.controls[control].invalid &&
           this.tradeForm.controls[control].touched;
  }

  get dateRangeError(): boolean {
    return this.tradeForm?.errors?.['closeBeforeOpen'] ?? false;
  }

  isIncomplete() {
    return this.tradeForm.invalid;
  }

  onSubmit() {
    this.errorMessage = '';
    this.successMessage = '';

    // Build trade data from form values
    let tradeData = this.tradeForm.value;

    this.webService.addTrade(tradeData).subscribe({
      next: (response: any) => {
        this.successMessage = 'Trade added successfully!';
        // Redirect to single trade view after short delay
        setTimeout(() => {
          this.router.navigate(['/journal', response.trade_id]);
        }, 1000);
      },
      error: (error: any) => {
        if (error.status === 400) {
          this.errorMessage = error.error?.error || 'Invalid trade data';
        } else {
          this.errorMessage = 'Failed to add trade. Please try again.';
        }
      }
    });
  }
}

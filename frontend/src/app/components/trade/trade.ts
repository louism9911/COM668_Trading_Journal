import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { WebService } from '../../services/web-service';
import { AuthService } from '../../services/auth-service';

@Component({
  selector: 'app-trade',
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  providers: [WebService],
  templateUrl: './trade.html',
  styleUrl: './trade.css'
})
export class Trade {

  trade: any = null;
  tradeId: string = '';
  isLoading: boolean = true;
  errorMessage: string = '';

  // ─── Edit Mode ────────────────────────────────────────
  isEditing: boolean = false;
  editForm: any;
  editMessage: string = '';

  // ─── Tag Form ─────────────────────────────────────────
  tagForm: any;
  showTagForm: boolean = false;
  tagMessage: string = '';

  // ─── Tag Edit ─────────────────────────────────────────
  editingTagId: string | null = null;
  editTagForm: any;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private formBuilder: FormBuilder,
    private webService: WebService,
    private authService: AuthService
  ) {}

  ngOnInit() {
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/login']);
      return;
    }

    // Get trade ID from route parameter (FE13 pattern)
    this.tradeId = this.route.snapshot.paramMap.get('id') || '';
    this.loadTrade();
    this.initForms();
  }

  initForms() {
    // Tag creation form
    this.tagForm = this.formBuilder.group({
      strategy: ['', Validators.required],
      entry_type: [''],
      emotional_state: [''],
      notes: ['']
    });

    // Tag edit form
    this.editTagForm = this.formBuilder.group({
      strategy: ['', Validators.required],
      entry_type: [''],
      emotional_state: [''],
      notes: ['']
    });
  }

  // ─── Load Trade ───────────────────────────────────────

  loadTrade() {
    this.isLoading = true;
    this.webService.getTrade(this.tradeId).subscribe({
      next: (response: any) => {
        this.trade = response;
        this.isLoading = false;
      },
      error: (error: any) => {
        this.errorMessage = 'Trade not found';
        this.isLoading = false;
      }
    });
  }

  // ─── Edit Trade ───────────────────────────────────────

  startEditing() {
    // Populate edit form with current trade data
    this.editForm = this.formBuilder.group({
      symbol:      [this.trade.symbol, Validators.required],
      type:        [this.trade.type, Validators.required],
      lots:        [this.trade.lots, [Validators.required, Validators.min(0.01)]],
      open_price:  [this.trade.open_price, Validators.required],
      close_price: [this.trade.close_price, Validators.required],
      profit:      [this.trade.profit, Validators.required],
      open_time:   [this.trade.open_time || ''],
      close_time:  [this.trade.close_time || ''],
      commission:  [this.trade.commission || 0],
      swap:        [this.trade.swap || 0],
      sl:          [this.trade.sl || 0],
      tp:          [this.trade.tp || 0],
      ticket:      [this.trade.ticket || '']
    });
    this.isEditing = true;
    this.editMessage = '';
  }

  cancelEditing() {
    this.isEditing = false;
    this.editMessage = '';
  }

  saveEdit() {
    this.editMessage = '';
    this.webService.updateTrade(this.tradeId, this.editForm.value).subscribe({
      next: (response: any) => {
        this.editMessage = 'Trade updated successfully';
        this.isEditing = false;
        // Reload trade to show updated data
        this.loadTrade();
      },
      error: (error: any) => {
        this.editMessage = 'Failed to update trade';
      }
    });
  }

  // ─── Delete Trade ─────────────────────────────────────

  deleteTrade() {
    if (confirm('Are you sure you want to delete this trade?')) {
      this.webService.deleteTrade(this.tradeId).subscribe({
        next: () => {
          this.router.navigate(['/journal']);
        },
        error: (error: any) => {
          this.errorMessage = 'Failed to delete trade';
        }
      });
    }
  }

  // ─── Tag CRUD ─────────────────────────────────────────

  toggleTagForm() {
    this.showTagForm = !this.showTagForm;
    this.tagMessage = '';
    if (this.showTagForm) {
      this.tagForm.reset({
        strategy: '', entry_type: '', emotional_state: '', notes: ''
      });
    }
  }

  addTag() {
    this.tagMessage = '';
    this.webService.addTag(this.tradeId, this.tagForm.value).subscribe({
      next: (response: any) => {
        this.tagMessage = 'Tag added successfully';
        this.showTagForm = false;
        this.loadTrade();
      },
      error: (error: any) => {
        this.tagMessage = 'Failed to add tag';
      }
    });
  }

  startEditingTag(tag: any) {
    this.editingTagId = tag._id;
    this.editTagForm.patchValue({
      strategy: tag.strategy || '',
      entry_type: tag.entry_type || '',
      emotional_state: tag.emotional_state || '',
      notes: tag.notes || ''
    });
  }

  cancelEditingTag() {
    this.editingTagId = null;
  }

  saveTag(tagId: string) {
    this.webService.updateTag(this.tradeId, tagId, this.editTagForm.value).subscribe({
      next: () => {
        this.editingTagId = null;
        this.loadTrade();
      },
      error: (error: any) => {
        console.error('Failed to update tag:', error);
      }
    });
  }

  deleteTag(tagId: string) {
    if (confirm('Delete this tag?')) {
      this.webService.deleteTag(this.tradeId, tagId).subscribe({
        next: () => {
          this.loadTrade();
        },
        error: (error: any) => {
          console.error('Failed to delete tag:', error);
        }
      });
    }
  }

  // ─── Helpers ──────────────────────────────────────────

  getProfitClass(value: number): string {
    if (value > 0) return 'text-success';
    if (value < 0) return 'text-danger';
    return '';
  }

  isEditFormInvalid(): boolean {
    return this.editForm ? this.editForm.invalid : true;
  }
}

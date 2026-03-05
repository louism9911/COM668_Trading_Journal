import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { WebService } from '../../services/web-service';
import { AuthService } from '../../services/auth-service';

@Component({
  selector: 'app-journal',
  imports: [CommonModule, RouterModule, FormsModule],
  providers: [WebService],
  templateUrl: './journal.html',
  styleUrl: './journal.css'
})
export class Journal {

  allTrades: any[] = [];
  isLoading: boolean = true;

  // ─── Filter & Sort State ──────────────────────────────
  private _filterSymbol:   string = '';
  private _filterType:     string = '';
  private _filterDateFrom: string = '';
  private _filterDateTo:   string = '';
  sortBy:    string = 'open_time';
  sortOrder: string = 'desc';

  // ─── Pagination ───────────────────────────────────────
  currentPage: number = 1;
  readonly pageSize:   number = 20;

  // Setters reset to page 1 when any filter changes
  get filterSymbol()   { return this._filterSymbol; }
  get filterType()     { return this._filterType; }
  get filterDateFrom() { return this._filterDateFrom; }
  get filterDateTo()   { return this._filterDateTo; }

  set filterSymbol(v: string)   { this._filterSymbol   = v; this.currentPage = 1; }
  set filterType(v: string)     { this._filterType     = v; this.currentPage = 1; }
  set filterDateFrom(v: string) { this._filterDateFrom = v; this.currentPage = 1; }
  set filterDateTo(v: string)   { this._filterDateTo   = v; this.currentPage = 1; }

  constructor(
    private webService: WebService,
    protected authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/login']);
      return;
    }
    this.loadTrades();
  }

  loadTrades() {
    this.isLoading = true;
    this.webService.getTrades(1, 10000).subscribe({
      next: (response: any) => {
        this.allTrades = response;
        this.isLoading = false;
      },
      error: () => { this.isLoading = false; }
    });
  }

  // ─── Filtering & Sorting ──────────────────────────────

  get hasActiveFilters(): boolean {
    return !!(this._filterSymbol.trim() || this._filterType ||
              this._filterDateFrom || this._filterDateTo);
  }

  get filteredTrades(): any[] {
    let result = [...this.allTrades];

    if (this._filterSymbol.trim()) {
      const sym = this._filterSymbol.trim().toUpperCase();
      result = result.filter(t => t.symbol?.toUpperCase().includes(sym));
    }

    if (this._filterType) {
      result = result.filter(t => t.type === this._filterType);
    }

    if (this._filterDateFrom) {
      const from = new Date(this._filterDateFrom);
      result = result.filter(t => {
        const d = t.open_time ? new Date(t.open_time) : null;
        return d && d >= from;
      });
    }

    if (this._filterDateTo) {
      const to = new Date(this._filterDateTo);
      to.setHours(23, 59, 59, 999);
      result = result.filter(t => {
        const d = t.open_time ? new Date(t.open_time) : null;
        return d && d <= to;
      });
    }

    result.sort((a, b) => {
      let aVal: any, bVal: any;
      switch (this.sortBy) {
        case 'symbol':     aVal = a.symbol;     bVal = b.symbol;     break;
        case 'profit':     aVal = a.profit;     bVal = b.profit;     break;
        case 'lots':       aVal = a.lots;       bVal = b.lots;       break;
        case 'open_price': aVal = a.open_price; bVal = b.open_price; break;
        default:           aVal = a.open_time;  bVal = b.open_time;
      }
      if (aVal < bVal) return this.sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return this.sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }

  // ─── Pagination ───────────────────────────────────────

  get totalPages(): number {
    return Math.ceil(this.filteredTrades.length / this.pageSize) || 1;
  }

  get pagedTrades(): any[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredTrades.slice(start, start + this.pageSize);
  }

  get pageNumbers(): number[] {
    const delta = 2;
    const pages: number[] = [];
    for (let i = Math.max(1, this.currentPage - delta);
             i <= Math.min(this.totalPages, this.currentPage + delta); i++) {
      pages.push(i);
    }
    return pages;
  }

  goToPage(n: number) {
    if (n < 1 || n > this.totalPages) return;
    this.currentPage = n;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  clearFilters() {
    this._filterSymbol   = '';
    this._filterType     = '';
    this._filterDateFrom = '';
    this._filterDateTo   = '';
    this.sortBy          = 'open_time';
    this.sortOrder       = 'desc';
    this.currentPage     = 1;
  }

  setSortBy(field: string) {
    if (this.sortBy === field) {
      this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortBy    = field;
      this.sortOrder = 'desc';
    }
    this.currentPage = 1;
  }

  // ─── Actions ──────────────────────────────────────────

  viewTrade(id: string) {
    this.router.navigate(['/journal', id]);
  }

  deleteTrade(id: string, event: Event) {
    event.stopPropagation();
    if (confirm('Are you sure you want to delete this trade?')) {
      this.webService.deleteTrade(id).subscribe({
        next: () => {
          this.loadTrades();
          // Stay on current page, but clamp if it no longer exists
          if (this.currentPage > this.totalPages) this.currentPage = this.totalPages;
        },
        error: () => {}
      });
    }
  }

  getProfitClass(value: number): string {
    if (value > 0) return 'text-success';
    if (value < 0) return 'text-danger';
    return '';
  }
}

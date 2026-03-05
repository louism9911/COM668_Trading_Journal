import { Component, OnInit, AfterViewInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { WebService } from '../../services/web-service';
import { AuthService } from '../../services/auth-service';

// Quick-access symbol chips shown above the chart
const QUICK_SYMBOLS = [
  { label: 'XAU/USD',  tv: 'OANDA:XAUUSD' },
  { label: 'EUR/USD',  tv: 'FX:EURUSD'    },
  { label: 'GBP/USD',  tv: 'FX:GBPUSD'    },
  { label: 'USD/JPY',  tv: 'FX:USDJPY'    },
  { label: 'US30',     tv: 'DJ:DJI'        },
  { label: 'NAS100',   tv: 'NASDAQ:NDX'    },
  { label: 'BTC/USD',  tv: 'BITSTAMP:BTCUSD' },
];

// Quick news topic chips below the search bar
const QUICK_TOPICS = ['Forex', 'Gold', 'EUR/USD', 'GBP/USD', 'Bitcoin', 'S&P 500', 'Federal Reserve'];

@Component({
  selector: 'app-research',
  imports: [CommonModule, FormsModule],
  providers: [WebService],
  templateUrl: './research.html',
  styleUrl: './research.css'
})
export class Research implements OnInit, AfterViewInit, OnDestroy {

  // Chart
  quickSymbols = QUICK_SYMBOLS;
  activeSymbol = QUICK_SYMBOLS[0];

  // News
  quickTopics = QUICK_TOPICS;
  newsQuery: string = '';
  newsResults: any[] = [];
  isLoadingNews: boolean = false;
  newsError: string = '';
  newsTotal: number = 0;

  // Pagination
  readonly articlesPerPage = 12;
  currentPage: number = 1;

  get totalPages(): number {
    return Math.ceil(this.newsResults.length / this.articlesPerPage);
  }

  get pagedResults(): any[] {
    const start = (this.currentPage - 1) * this.articlesPerPage;
    return this.newsResults.slice(start, start + this.articlesPerPage);
  }

  get pageNumbers(): number[] {
    const total = this.totalPages;
    const cur   = this.currentPage;
    const delta = 2;
    const pages: number[] = [];
    for (let i = Math.max(1, cur - delta); i <= Math.min(total, cur + delta); i++) {
      pages.push(i);
    }
    return pages;
  }

  goToPage(page: number) {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    const anchor = document.querySelector('.news-results-anchor');
    if (anchor) {
      window.scrollTo({ top: anchor.getBoundingClientRect().top + window.scrollY - 90, behavior: 'smooth' });
    }
  }

  @ViewChild('tvContainer') tvContainer!: ElementRef;

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
  }

  ngAfterViewInit() {
    this.loadTradingViewWidget(this.activeSymbol.tv);
  }

  ngOnDestroy() {
    // Remove the container contents so the widget cleans up
    if (this.tvContainer?.nativeElement) {
      this.tvContainer.nativeElement.innerHTML = '';
    }
  }

  // ─── TradingView Chart ──────────────────────────────────

  selectSymbol(sym: typeof QUICK_SYMBOLS[0]) {
    this.activeSymbol = sym;
    this.loadTradingViewWidget(sym.tv);
  }

  loadTradingViewWidget(symbol: string) {
    if (!this.tvContainer) return;
    this.tvContainer.nativeElement.innerHTML = '';

    const containerId = 'tv_widget_container';
    const inner = document.createElement('div');
    inner.id = containerId;
    this.tvContainer.nativeElement.appendChild(inner);

    const initWidget = () => {
      new (window as any).TradingView.widget({
        container_id:        containerId,
        symbol:              symbol,
        interval:            'D',
        timezone:            'Etc/UTC',
        theme:               'light',
        style:               '1',
        locale:              'en',
        width:               '100%',
        height:              460,
        allow_symbol_change: true,
        save_image:          false,
        hide_side_toolbar:   false,
        withdateranges:      true,
      });
    };

    if ((window as any).TradingView) {
      initWidget();
    } else {
      const script = document.createElement('script');
      script.src = 'https://s3.tradingview.com/tv.js';
      script.async = true;
      script.onload = initWidget;
      document.head.appendChild(script);
    }
  }

  // ─── News ───────────────────────────────────────────────

  fetchNews() {
    if (!this.newsQuery.trim()) return;
    this.isLoadingNews = true;
    this.newsError = '';
    this.newsResults = [];
    this.currentPage = 1;

    this.webService.getNews(this.newsQuery.trim()).subscribe({
      next: (response: any) => {
        this.newsResults = response.articles || [];
        this.newsTotal   = response.totalResults || 0;
        this.isLoadingNews = false;
      },
      error: () => {
        this.newsError = 'Could not load news. Please try again.';
        this.isLoadingNews = false;
      }
    });
  }

  setQuickTopic(topic: string) {
    this.newsQuery = topic;
    this.fetchNews();
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
  }
}

import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { WebService } from '../../services/web-service';
import { AuthService } from '../../services/auth-service';
import Chart from 'chart.js/auto';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, FormsModule],
  providers: [WebService],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class Dashboard implements OnInit, OnDestroy {

  // Summary data from /analytics/summary
  summary: any = {};

  // Chart data arrays
  bySymbolData: any[] = [];
  byMonthData:  any[] = [];
  byTypeData:   any[] = [];
  topTrades:    any[] = [];

  // Date range filter (FR15)
  dateFrom: string = '';
  dateTo:   string = '';

  // Loading state
  isLoading: boolean = true;

  // Tag / behavioural analytics
  tagData: any = null;

  // Chart.js instances
  private equityChart:  Chart | null = null;
  private symbolChart:  Chart | null = null;
  private winLossChart: Chart | null = null;
  private emotionChart: Chart | null = null;

  // Canvas element references
  @ViewChild('equityCanvas')  equityCanvas!: ElementRef;
  @ViewChild('symbolCanvas')  symbolCanvas!: ElementRef;
  @ViewChild('winLossCanvas') winLossCanvas!: ElementRef;
  @ViewChild('emotionCanvas') emotionCanvas!: ElementRef;

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
    this.loadAll();
  }

  ngOnDestroy() {
    this.destroyCharts();
  }

  private loadAll() {
    const f = this.dateFrom || undefined;
    const t = this.dateTo   || undefined;
    this.loadSummary(f, t);
    this.loadBySymbol(f, t);
    this.loadByMonth(f, t);
    this.loadByType(f, t);
    this.loadTopTrades(f, t);
    this.loadTagAnalytics(f, t);
  }

  applyDateFilter() {
    this.isLoading = true;
    this.destroyCharts();
    this.loadAll();
  }

  clearDateFilter() {
    this.dateFrom = '';
    this.dateTo   = '';
    this.isLoading = true;
    this.destroyCharts();
    this.loadAll();
  }

  get hasDateFilter(): boolean {
    return !!(this.dateFrom || this.dateTo);
  }

  // ─── Data Loading Methods ─────────────────────────────

  loadSummary(dateFrom?: string, dateTo?: string) {
    this.webService.getAnalyticsSummary(dateFrom, dateTo).subscribe({
      next: (response: any) => {
        this.summary   = response;
        this.isLoading = false;

        // After DOM becomes visible, render all charts that may have
        // already received data while isLoading was still true
        setTimeout(() => {
          this.renderWinLossChart();
          if (this.byMonthData.length > 0)         this.renderEquityChart();
          if (this.bySymbolData.length > 0)         this.renderSymbolChart();
          if (this.tagData?.by_emotion?.length > 0) this.renderEmotionChart();
        }, 150);
      },
      error: () => { this.isLoading = false; }
    });
  }

  loadBySymbol(dateFrom?: string, dateTo?: string) {
    this.webService.getAnalyticsBySymbol(dateFrom, dateTo).subscribe({
      next: (response: any) => {
        this.bySymbolData = response;
        if (!this.isLoading) setTimeout(() => this.renderSymbolChart(), 100);
      },
      error: () => {}
    });
  }

  loadByMonth(dateFrom?: string, dateTo?: string) {
    this.webService.getAnalyticsByMonth(dateFrom, dateTo).subscribe({
      next: (response: any) => {
        this.byMonthData = response.sort((a: any, b: any) => {
          if (a.year !== b.year) return a.year - b.year;
          return a.month - b.month;
        });
        if (!this.isLoading) setTimeout(() => this.renderEquityChart(), 100);
      },
      error: () => {}
    });
  }

  loadByType(dateFrom?: string, dateTo?: string) {
    this.webService.getAnalyticsByType(dateFrom, dateTo).subscribe({
      next: (response: any) => { this.byTypeData = response; },
      error: () => {}
    });
  }

  loadTopTrades(dateFrom?: string, dateTo?: string) {
    this.webService.getTopTrades(10, dateFrom, dateTo).subscribe({
      next: (response: any) => { this.topTrades = response; },
      error: () => {}
    });
  }

  loadTagAnalytics(dateFrom?: string, dateTo?: string) {
    this.webService.getTagAnalytics(dateFrom, dateTo).subscribe({
      next: (response: any) => {
        this.tagData = response;
        if (!this.isLoading) setTimeout(() => this.renderEmotionChart(), 100);
      },
      error: () => {}
    });
  }

  // ─── Behavioural Insight Getters ──────────────────────

  get bestStrategy(): any {
    if (!this.tagData?.by_strategy?.length) return null;
    const eligible = this.tagData.by_strategy.filter((s: any) => s.trade_count >= 2);
    if (!eligible.length) return null;
    return eligible.reduce((best: any, curr: any) =>
      curr.win_rate > best.win_rate ? curr : best);
  }

  get bestEmotion(): any {
    if (!this.tagData?.by_emotion?.length) return null;
    const eligible = this.tagData.by_emotion.filter((e: any) => e.trade_count >= 2);
    if (!eligible.length) return null;
    return eligible.reduce((best: any, curr: any) =>
      curr.win_rate > best.win_rate ? curr : best);
  }

  get worstEmotion(): any {
    if (!this.tagData?.by_emotion?.length) return null;
    const eligible = this.tagData.by_emotion.filter((e: any) => e.trade_count >= 2);
    if (eligible.length < 2) return null;
    return eligible.reduce((worst: any, curr: any) =>
      curr.win_rate < worst.win_rate ? curr : worst);
  }

  get hasTagInsights(): boolean {
    return !!(this.bestStrategy || this.bestEmotion);
  }

  // ─── Chart Helpers ────────────────────────────────────

  private destroyCharts() {
    if (this.equityChart)  { this.equityChart.destroy();  this.equityChart  = null; }
    if (this.symbolChart)  { this.symbolChart.destroy();  this.symbolChart  = null; }
    if (this.winLossChart) { this.winLossChart.destroy(); this.winLossChart = null; }
    if (this.emotionChart) { this.emotionChart.destroy(); this.emotionChart = null; }
  }

  // ─── Chart Rendering Methods ──────────────────────────

  renderEquityChart() {
    if (!this.equityCanvas || this.byMonthData.length === 0) return;

    const ctx        = this.equityCanvas.nativeElement.getContext('2d');
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun',
                        'Jul','Aug','Sep','Oct','Nov','Dec'];
    const labels     = this.byMonthData.map(
      (d: any) => monthNames[d.month - 1] + ' ' + d.year
    );

    let cumulative = 0;
    const cumulativeData = this.byMonthData.map((d: any) => {
      cumulative += d.total_profit;
      return Math.round(cumulative * 100) / 100;
    });
    const monthlyPnL = this.byMonthData.map((d: any) => d.total_profit);

    this.equityChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Cumulative P&L',
            data: cumulativeData,
            type: 'line',
            borderColor: '#0d6efd',
            backgroundColor: 'rgba(13, 110, 253, 0.1)',
            fill: true,
            tension: 0.3,
            yAxisID: 'y'
          },
          {
            label: 'Monthly P&L',
            data: monthlyPnL,
            type: 'bar',
            backgroundColor: monthlyPnL.map(
              (v: number) => v >= 0 ? 'rgba(25, 135, 84, 0.7)' : 'rgba(220, 53, 69, 0.7)'
            ),
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'top' },
          title: { display: true, text: 'Equity Curve & Monthly P&L' }
        },
        scales: {
          y:  { position: 'left',  title: { display: true, text: 'Cumulative P&L' } },
          y1: { position: 'right', title: { display: true, text: 'Monthly P&L' },
                grid: { drawOnChartArea: false } }
        }
      }
    });
  }

  renderSymbolChart() {
    if (!this.symbolCanvas || this.bySymbolData.length === 0) return;

    const ctx         = this.symbolCanvas.nativeElement.getContext('2d');
    const labels      = this.bySymbolData.map((d: any) => d.symbol);
    const profits     = this.bySymbolData.map((d: any) => d.total_profit);
    const tradeCounts = this.bySymbolData.map((d: any) => d.total_trades);

    this.symbolChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Total P&L',
          data: profits,
          backgroundColor: profits.map(
            (v: number) => v >= 0 ? 'rgba(25, 135, 84, 0.7)' : 'rgba(220, 53, 69, 0.7)'
          ),
          borderColor: profits.map(
            (v: number) => v >= 0 ? '#198754' : '#dc3545'
          ),
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'top' },
          title: { display: true, text: 'P&L by Symbol' },
          tooltip: {
            callbacks: {
              afterLabel: (context: any) =>
                'Trades: ' + tradeCounts[context.dataIndex]
            }
          }
        },
        scales: {
          y: { title: { display: true, text: 'Profit / Loss' } }
        }
      }
    });
  }

  renderWinLossChart() {
    if (!this.winLossCanvas || !this.summary.total_trades) return;

    const ctx       = this.winLossCanvas.nativeElement.getContext('2d');
    const breakeven = this.summary.total_trades
                    - this.summary.winning_trades
                    - this.summary.losing_trades;

    this.winLossChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Winning', 'Losing', 'Breakeven'],
        datasets: [{
          data: [this.summary.winning_trades, this.summary.losing_trades, breakeven],
          backgroundColor: [
            'rgba(25, 135, 84, 0.8)',
            'rgba(220, 53, 69, 0.8)',
            'rgba(108, 117, 125, 0.8)'
          ],
          borderColor: ['#198754', '#dc3545', '#6c757d'],
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom' },
          title: { display: true, text: 'Win / Loss Distribution' }
        }
      }
    });
  }

  renderEmotionChart() {
    if (!this.emotionCanvas || !this.tagData?.by_emotion?.length) return;

    const emotions = this.tagData.by_emotion.map((e: any) => e.emotion);
    const winRates = this.tagData.by_emotion.map((e: any) => e.win_rate);

    const ctx = this.emotionCanvas.nativeElement.getContext('2d');
    this.emotionChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: emotions,
        datasets: [{
          label: 'Win Rate %',
          data: winRates,
          backgroundColor: 'rgba(13, 110, 253, 0.75)',
          borderRadius: 4,
          categoryPercentage: 0.6,
          barPercentage: 0.85,
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          title:  { display: false },
          tooltip: {
            callbacks: {
              label: (ctx: any) => ` ${ctx.parsed.x}% win rate`,
              afterLabel: (ctx: any) => {
                const d = this.tagData.by_emotion[ctx.dataIndex];
                return `Trades: ${d.trade_count}   Avg P&L: $${d.avg_profit}`;
              }
            }
          }
        },
        scales: {
          x: {
            min: 0, max: 100,
            ticks: { callback: (v: any) => v + '%', maxTicksLimit: 6 },
            grid: { color: 'rgba(0,0,0,0.06)' },
            border: { display: false }
          },
          y: { grid: { display: false }, ticks: { font: { size: 12 } } }
        }
      }
    });
  }

  // ─── Helper Methods ───────────────────────────────────

  getPnLClass(value: number): string {
    if (value > 0) return 'text-success';
    if (value < 0) return 'text-danger';
    return 'text-secondary';
  }

  formatProfitFactor(pf: number | null): string {
    if (pf === null) return '∞';
    return pf.toFixed(2);
  }
}

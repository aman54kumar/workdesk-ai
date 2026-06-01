import { Component, inject, OnInit, signal } from '@angular/core';
import {
  clientDateBoundsFallback,
  normalizeRangeDates,
  validateDateRange,
  type DateBounds,
} from '../../core/utils/date-range-validation';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DateFieldComponent } from '../../shared/components/date-field/date-field.component';
import {
  AdminService,
  AnalyticsSummary,
  AnalyticsToolRow,
  FeedbackComment,
} from '../../core/services/admin.service';

@Component({
  selector: 'app-admin-analytics',
  standalone: true,
  imports: [FormsModule, DecimalPipe, DateFieldComponent],
  template: `
    @if (rangeError()) {
      <p class="mb-2 text-sm text-danger">{{ rangeError() }}</p>
    }
    <form class="date-range-bar mb-4 flex w-full items-center gap-2" (ngSubmit)="applyRange()">
      <app-date-field
        [(ngModel)]="sinceDate"
        name="sinceDate"
        ariaLabel="From date"
        [minDate]="bounds().minDate"
        [maxDate]="sinceMax()"
      />
      <span class="shrink-0 text-xs font-medium text-muted" aria-hidden="true">to</span>
      <app-date-field
        [(ngModel)]="untilDate"
        name="untilDate"
        ariaLabel="Until date"
        [minDate]="untilMin()"
        [maxDate]="bounds().maxDate"
      />
      <button type="submit" class="btn-secondary shrink-0 text-sm">Apply range</button>
    </form>

    @if (loadError()) {
      <p class="text-sm text-danger">{{ loadError() }}</p>
    } @else if (loading()) {
      <p class="text-sm text-muted">Loading…</p>
    } @else {
      @if (summary(); as s) {
        <div class="mb-6 grid gap-4 sm:grid-cols-3">
          <div class="rounded-2xl border border-stroke bg-surface p-4">
            <p class="text-xs text-muted">Total requests</p>
            <p class="text-2xl font-semibold">{{ s.total_requests }}</p>
          </div>
          <div class="rounded-2xl border border-stroke bg-surface p-4">
            <p class="text-xs text-muted">Cache hit rate</p>
            <p class="text-2xl font-semibold">{{ (s.cache_hit_rate * 100) | number: '1.0-1' }}%</p>
          </div>
          <div class="rounded-2xl border border-stroke bg-surface p-4">
            <p class="text-xs text-muted">Avg latency</p>
            <p class="text-2xl font-semibold">{{ s.avg_latency_ms }} ms</p>
          </div>
        </div>
      }

      <div class="mb-6 overflow-hidden rounded-2xl border border-stroke bg-surface">
        <table class="w-full text-left text-sm">
          <thead class="border-b border-stroke text-xs uppercase text-muted">
            <tr>
              <th class="px-4 py-3">Tool</th>
              <th class="px-4 py-3">Usage</th>
              <th class="px-4 py-3">Cache %</th>
              <th class="px-4 py-3">Avg ms</th>
              <th class="px-4 py-3">Errors</th>
              <th class="px-4 py-3">👍 / 👎</th>
            </tr>
          </thead>
          <tbody>
            @for (row of tools(); track row.task_type) {
              <tr class="border-b border-stroke last:border-0">
                <td class="px-4 py-3 font-mono text-xs">{{ row.task_type }}</td>
                <td class="px-4 py-3">{{ row.usage_count }}</td>
                <td class="px-4 py-3">{{ (row.cache_hit_rate * 100) | number: '1.0-0' }}%</td>
                <td class="px-4 py-3">{{ row.avg_latency_ms }}</td>
                <td class="px-4 py-3">{{ row.errors + row.timeouts + row.cancelled }}</td>
                <td class="px-4 py-3">{{ row.thumbs_up }} / {{ row.thumbs_down }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <h2 class="mb-2 text-sm font-semibold">Recent comments (👎)</h2>
      <div class="space-y-2">
        @for (c of comments(); track c.id) {
          <div class="rounded-xl border border-stroke bg-surface px-4 py-3 text-sm">
            <p class="text-xs text-muted">{{ c.task_type }} · {{ c.created_at }}</p>
            <p>{{ c.comment }}</p>
          </div>
        } @empty {
          <p class="text-sm text-muted">No comments in this range.</p>
        }
      </div>
    }
  `,
})
export default class AdminAnalyticsComponent implements OnInit {
  private admin = inject(AdminService);
  private router = inject(Router);

  summary = signal<AnalyticsSummary | null>(null);
  tools = signal<AnalyticsToolRow[]>([]);
  comments = signal<FeedbackComment[]>([]);
  loading = signal(true);
  loadError = signal('');
  sinceDate = '';
  untilDate = '';
  bounds = signal<DateBounds>(clientDateBoundsFallback());
  rangeError = signal('');

  ngOnInit(): void {
    this.admin.getDateBounds().subscribe({
      next: (row) => {
        this.bounds.set({ minDate: row.min_date, maxDate: row.max_date });
        this.syncDatesToBounds();
        this.reload();
      },
      error: () => this.reload(),
    });
  }

  sinceMax(): string {
    const max = this.bounds().maxDate;
    return this.untilDate && this.untilDate < max ? this.untilDate : max;
  }

  untilMin(): string {
    const min = this.bounds().minDate;
    return this.sinceDate && this.sinceDate > min ? this.sinceDate : min;
  }

  applyRange(): void {
    const err = validateDateRange(this.sinceDate, this.untilDate, this.bounds());
    if (err) {
      this.rangeError.set(err);
      return;
    }
    this.rangeError.set('');
    this.reload();
  }

  private syncDatesToBounds(): void {
    const next = normalizeRangeDates(this.sinceDate, this.untilDate, this.bounds());
    this.sinceDate = next.since;
    this.untilDate = next.until;
  }

  reload(): void {
    this.loading.set(true);
    this.loadError.set('');
    const since = this.sinceDate ? `${this.sinceDate}T00:00:00` : undefined;
    const until = this.untilDate ? `${this.untilDate}T23:59:59` : undefined;
    this.admin.getAnalyticsSummary(since, until).subscribe({
      next: (s) => this.summary.set(s),
      error: (err) => this.onError(err),
    });
    this.admin.getAnalyticsTools(since, until).subscribe({
      next: (t) => this.tools.set(t),
      error: (err) => this.onError(err),
    });
    this.admin.getAnalyticsComments(since, until).subscribe({
      next: (c) => {
        this.comments.set(c);
        this.loading.set(false);
      },
      error: (err) => this.onError(err),
    });
  }

  private onError(err: { status?: number }): void {
    this.loading.set(false);
    if (err.status === 401) {
      this.admin.logout();
      this.router.navigate(['/admin/login']);
      return;
    }
    this.loadError.set('Request failed.');
  }
}

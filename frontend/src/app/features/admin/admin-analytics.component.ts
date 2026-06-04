import { Component, computed, inject, OnInit, signal } from '@angular/core';
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
  AnalyticsDashboard,
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
    <form class="date-range-bar mb-4 flex w-full flex-wrap items-center gap-2" (ngSubmit)="applyRange()">
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
      @if (dash(); as d) {
      <p class="mb-4 text-xs text-muted">{{ d.systems.tracking_note }}</p>

      <h2 class="mb-2 text-sm font-semibold">Overview</h2>
      <div class="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div class="rounded-2xl border border-stroke bg-surface p-4">
          <p class="text-xs text-muted">Unique systems</p>
          <p class="text-2xl font-semibold">{{ d.overview.unique_systems }}</p>
          <p class="mt-1 text-xs text-muted">
            {{ d.overview.avg_requests_per_system | number: '1.0-1' }} req / system avg
          </p>
        </div>
        <div class="rounded-2xl border border-stroke bg-surface p-4">
          <p class="text-xs text-muted">Total requests</p>
          <p class="text-2xl font-semibold">{{ d.overview.total_requests }}</p>
          <p class="mt-1 text-xs text-muted">
            Web {{ d.overview.requests_web }} · Outlook {{ d.overview.requests_outlook }}
          </p>
        </div>
        <div class="rounded-2xl border border-stroke bg-surface p-4">
          <p class="text-xs text-muted">Success rate</p>
          <p class="text-2xl font-semibold">
            {{ (d.overview.success_rate * 100) | number: '1.0-1' }}%
          </p>
          <p class="mt-1 text-xs text-muted">
            {{ d.overview.failure_count }} failed / cancelled / timeout
          </p>
        </div>
        <div class="rounded-2xl border border-stroke bg-surface p-4">
          <p class="text-xs text-muted">Cache hit · Avg latency</p>
          <p class="text-2xl font-semibold">
            {{ (d.overview.cache_hit_rate * 100) | number: '1.0-0' }}%
          </p>
          <p class="mt-1 text-xs text-muted">{{ d.overview.avg_latency_ms }} ms (non-cached)</p>
        </div>
      </div>

      <div class="mb-6 grid gap-3 sm:grid-cols-3">
        <div class="rounded-2xl border border-stroke bg-surface p-4">
          <p class="text-xs text-muted">New systems in range</p>
          <p class="text-xl font-semibold">{{ d.systems.new_systems }}</p>
        </div>
        <div class="rounded-2xl border border-stroke bg-surface p-4">
          <p class="text-xs text-muted">Returning systems</p>
          <p class="text-xl font-semibold">{{ d.systems.returning_systems }}</p>
        </div>
        <div class="rounded-2xl border border-stroke bg-surface p-4">
          <p class="text-xs text-muted">Input volume</p>
          <p class="text-xl font-semibold">{{ formatChars(d.overview.total_input_chars) }}</p>
        </div>
      </div>

      <h2 class="mb-2 text-sm font-semibold">AI usage (local vs cloud)</h2>
      <div class="mb-6 grid gap-4 lg:grid-cols-2">
        <div class="rounded-2xl border border-stroke bg-surface p-4">
          <p class="mb-2 text-xs font-medium uppercase text-muted">By source</p>
          @for (row of d.llm.by_source; track row.source) {
            <div class="mb-2 flex items-center justify-between text-sm">
              <span class="capitalize">{{ row.source }}</span>
              <span>{{ row.count }} ({{ row.pct | number: '1.0-1' }}%)</span>
            </div>
          } @empty {
            <p class="text-sm text-muted">No data in this range.</p>
          }
        </div>
        <div class="rounded-2xl border border-stroke bg-surface p-4">
          <p class="mb-2 text-xs font-medium uppercase text-muted">Cloud providers</p>
          @for (row of d.llm.by_provider; track row.provider) {
            <div class="mb-2 flex items-center justify-between text-sm">
              <span class="capitalize">{{ row.provider }}</span>
              <span>{{ row.count }} ({{ row.pct | number: '1.0-1' }}%)</span>
            </div>
          } @empty {
            <p class="text-sm text-muted">No cloud requests in this range.</p>
          }
        </div>
      </div>

      @if (d.llm.by_model.length) {
        <div class="mb-6 overflow-hidden rounded-2xl border border-stroke bg-surface">
          <p class="border-b border-stroke px-4 py-2 text-xs font-medium uppercase text-muted">
            Top models
          </p>
          <table class="w-full text-left text-sm">
            <thead class="border-b border-stroke text-xs uppercase text-muted">
              <tr>
                <th class="px-4 py-2">Model</th>
                <th class="px-4 py-2">Source</th>
                <th class="px-4 py-2">Requests</th>
              </tr>
            </thead>
            <tbody>
              @for (m of d.llm.by_model; track m.model + m.llm_source) {
                <tr class="border-b border-stroke last:border-0">
                  <td class="px-4 py-2 font-mono text-xs">{{ m.model }}</td>
                  <td class="px-4 py-2 capitalize">{{ m.llm_source }}</td>
                  <td class="px-4 py-2">{{ m.count }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      <h2 class="mb-2 text-sm font-semibold">Tools — popularity &amp; health</h2>
      <div class="mb-6 overflow-x-auto rounded-2xl border border-stroke bg-surface">
        <table class="w-full min-w-[720px] text-left text-sm">
          <thead class="border-b border-stroke text-xs uppercase text-muted">
            <tr>
              <th class="px-4 py-3">Tool</th>
              <th class="px-4 py-3">Share</th>
              <th class="px-4 py-3">Requests</th>
              <th class="px-4 py-3">Systems</th>
              <th class="px-4 py-3">Local / Cloud</th>
              <th class="px-4 py-3">Cache %</th>
              <th class="px-4 py-3">Avg ms</th>
              <th class="px-4 py-3">Issues</th>
              <th class="px-4 py-3">👍 / 👎</th>
            </tr>
          </thead>
          <tbody>
            @for (row of d.tools; track row.task_type) {
              <tr class="border-b border-stroke last:border-0">
                <td class="px-4 py-3">
                  <span class="font-medium">{{ row.display_name }}</span>
                  <span class="block font-mono text-xs text-muted">{{ row.task_type }}</span>
                </td>
                <td class="px-4 py-3">{{ row.share_pct | number: '1.0-1' }}%</td>
                <td class="px-4 py-3">{{ row.usage_count }}</td>
                <td class="px-4 py-3">{{ row.unique_systems }}</td>
                <td class="px-4 py-3 text-xs">{{ row.local_count }} / {{ row.cloud_count }}</td>
                <td class="px-4 py-3">{{ (row.cache_hit_rate * 100) | number: '1.0-0' }}%</td>
                <td class="px-4 py-3">{{ row.avg_latency_ms }}</td>
                <td class="px-4 py-3">{{ row.errors + row.timeouts + row.cancelled }}</td>
                <td class="px-4 py-3">
                  {{ row.thumbs_up }} / {{ row.thumbs_down }}
                  @if (row.satisfaction_rate !== null) {
                    <span class="block text-xs text-muted">
                      {{ (row.satisfaction_rate * 100) | number: '1.0-0' }}% positive
                    </span>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      @if (d.unused_tools.length) {
        <div class="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
          <h2 class="mb-2 text-sm font-semibold">Enabled but unused in range</h2>
          <p class="mb-2 text-xs text-muted">
            These tools are on for users but had no generations in the selected dates — consider
            promoting, training, or disabling.
          </p>
          <ul class="flex flex-wrap gap-2 text-sm">
            @for (t of d.unused_tools; track t.task_type) {
              <li class="rounded-lg border border-stroke bg-surface px-3 py-1">
                {{ t.display_name }}
              </li>
            }
          </ul>
        </div>
      }

      @if (d.trends.length) {
        <h2 class="mb-2 text-sm font-semibold">Daily activity</h2>
        <div class="mb-6 overflow-x-auto rounded-2xl border border-stroke bg-surface">
          <table class="w-full text-left text-sm">
            <thead class="border-b border-stroke text-xs uppercase text-muted">
              <tr>
                <th class="px-4 py-2">Date</th>
                <th class="px-4 py-2">Requests</th>
                <th class="px-4 py-2">Unique systems</th>
              </tr>
            </thead>
            <tbody>
              @for (day of d.trends; track day.date) {
                <tr class="border-b border-stroke last:border-0">
                  <td class="px-4 py-2">{{ day.date }}</td>
                  <td class="px-4 py-2">{{ day.requests }}</td>
                  <td class="px-4 py-2">{{ day.unique_systems }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      @if (peakHourLabel(); as peak) {
        <p class="mb-4 text-sm text-muted">
          Busiest hour (server time): <strong>{{ peak.hour }}:00</strong> with
          {{ peak.requests }} requests
        </p>
      }

      <h2 class="mb-2 text-sm font-semibold">Feedback summary</h2>
      <div class="mb-6 grid gap-3 sm:grid-cols-3">
        <div class="rounded-2xl border border-stroke bg-surface p-4">
          <p class="text-xs text-muted">👍 / 👎</p>
          <p class="text-xl font-semibold">{{ d.feedback.thumbs_up }} / {{ d.feedback.thumbs_down }}</p>
          @if (d.feedback.satisfaction_rate !== null) {
            <p class="text-xs text-muted">
              {{ (d.feedback.satisfaction_rate * 100) | number: '1.0-0' }}% positive
            </p>
          }
        </div>
        <div class="rounded-2xl border border-stroke bg-surface p-4 sm:col-span-2">
          <p class="text-xs text-muted">Written comments</p>
          <p class="text-xl font-semibold">{{ d.feedback.comment_count }}</p>
        </div>
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
    }
  `,
})
export default class AdminAnalyticsComponent implements OnInit {
  private admin = inject(AdminService);
  private router = inject(Router);

  dash = signal<AnalyticsDashboard | null>(null);
  comments = signal<FeedbackComment[]>([]);
  loading = signal(true);
  loadError = signal('');
  sinceDate = '';
  untilDate = '';
  bounds = signal<DateBounds>(clientDateBoundsFallback());
  rangeError = signal('');

  peakHourLabel = computed(() => {
    const hours = this.dash()?.peak_hours ?? [];
    if (!hours.length) return null;
    return hours.reduce((a, b) => (b.requests > a.requests ? b : a));
  });

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

  formatChars(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M chars`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K chars`;
    return `${n} chars`;
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

    this.admin.getAnalyticsDashboard(since, until).subscribe({
      next: (d) => {
        this.dash.set(d);
        this.loading.set(false);
      },
      error: (err) => this.onError(err),
    });

    this.admin.getAnalyticsComments(since, until).subscribe({
      next: (c) => this.comments.set(c),
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

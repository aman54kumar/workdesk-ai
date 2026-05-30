import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AdminService, AppFeedback } from '../../core/services/admin.service';

@Component({
  selector: 'app-admin-feedback',
  standalone: true,
  imports: [DatePipe, FormsModule],
  template: `
    <div class="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 class="text-xl font-semibold text-content">User feedback</h2>
        <p class="mt-1 text-sm text-muted">
          Review general issues, suggestions, and improvement requests submitted from the app.
        </p>
      </div>
      <div class="flex flex-wrap gap-3">
        <input type="date" class="field-input text-sm" [(ngModel)]="sinceDate" />
        <input type="date" class="field-input text-sm" [(ngModel)]="untilDate" />
        <button type="button" class="btn-secondary text-sm" (click)="reload()">Apply range</button>
      </div>
    </div>

    @if (loadError()) {
      <p class="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{{ loadError() }}</p>
    } @else if (loading()) {
      <p class="text-sm text-muted">Loading feedback...</p>
    } @else {
      <div class="mb-4 rounded-2xl border border-stroke bg-surface px-4 py-3 text-sm text-muted">
        Showing {{ feedback().length }} submission{{ feedback().length === 1 ? '' : 's' }}.
      </div>

      <div class="space-y-3">
        @for (item of feedback(); track item.id) {
          <article class="rounded-2xl border border-stroke bg-surface p-4">
            <div class="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 class="font-semibold text-content">{{ item.name }}</h3>
                <p class="text-xs text-muted">
                  {{ item.created_at | date: 'medium' }}
                  @if (item.email_or_phone) {
                    <span> · {{ item.email_or_phone }}</span>
                  }
                </p>
              </div>
              <span class="rounded-full border border-stroke bg-surface-raised px-3 py-1 text-xs text-muted">
                {{ item.ip_address || 'IP unavailable' }}
              </span>
            </div>

            <p class="whitespace-pre-wrap text-sm leading-relaxed text-content">{{ item.issue }}</p>

            <div class="mt-4 grid gap-2 border-t border-stroke/70 pt-3 text-xs text-muted md:grid-cols-2">
              <p class="min-w-0">
                <span class="font-medium text-content">Page:</span>
                <span class="break-all">{{ item.page_url || 'Not provided' }}</span>
              </p>
              <p class="min-w-0">
                <span class="font-medium text-content">Browser:</span>
                <span class="break-all">{{ item.user_agent || 'Not provided' }}</span>
              </p>
            </div>
          </article>
        } @empty {
          <div class="rounded-2xl border border-dashed border-stroke px-6 py-12 text-center">
            <p class="text-sm font-medium text-content">No feedback in this range</p>
            <p class="mt-1 text-xs text-muted">New submissions will appear here automatically.</p>
          </div>
        }
      </div>
    }
  `,
})
export default class AdminFeedbackComponent implements OnInit {
  private admin = inject(AdminService);
  private router = inject(Router);

  feedback = signal<AppFeedback[]>([]);
  loading = signal(true);
  loadError = signal('');
  sinceDate = '';
  untilDate = '';

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.loadError.set('');
    const since = this.sinceDate ? `${this.sinceDate}T00:00:00` : undefined;
    const until = this.untilDate ? `${this.untilDate}T23:59:59` : undefined;
    this.admin.getAppFeedback(since, until).subscribe({
      next: (rows) => {
        this.feedback.set(rows);
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
    this.loadError.set('Request failed. Is the backend running?');
  }
}

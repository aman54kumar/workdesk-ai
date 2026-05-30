import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { FeedbackService } from '../../core/services/feedback.service';

@Component({
  selector: 'app-feedback',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="page-wrap">
      <div class="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Feedback</p>
          <h1 class="page-title mt-2">Tell us what needs attention</h1>
          <p class="page-desc max-w-2xl">
            Share issues, suggestions, or improvement ideas for WorkDesk AI. Your feedback helps us
            prioritise the next set of useful internal tools.
          </p>
        </div>
        <a routerLink="/" class="btn-secondary text-sm">Back to home</a>
      </div>

      <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <form class="space-y-5" (ngSubmit)="submit()">
          <div>
            <label for="feedbackName" class="field-label">Name</label>
            <input
              id="feedbackName"
              name="name"
              type="text"
              class="field-input"
              maxlength="120"
              [(ngModel)]="name"
              placeholder="Your name"
              required
            />
          </div>

          <div>
            <label for="feedbackContact" class="field-label">
              Email or phone <span class="field-hint">(optional)</span>
            </label>
            <input
              id="feedbackContact"
              name="emailOrPhone"
              type="text"
              class="field-input"
              maxlength="160"
              [(ngModel)]="emailOrPhone"
              placeholder="For follow-up, if needed"
            />
          </div>

          <div>
            <label for="feedbackIssue" class="field-label">Issue or suggestion</label>
            <textarea
              id="feedbackIssue"
              name="issue"
              rows="8"
              class="field-input"
              maxlength="4000"
              [(ngModel)]="issue"
              placeholder="Describe what happened, what you expected, or what would make the app better."
              required
            ></textarea>
            <p class="mt-1 text-xs text-faint">{{ issue.trim().length }}/4000 characters</p>
          </div>

          @if (error()) {
            <p class="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{{ error() }}</p>
          }

          @if (success()) {
            <p class="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600 dark:text-emerald-300">
              Thank you. Your feedback has been submitted and will be reviewed by the admin team.
            </p>
          }

          <button type="submit" class="btn-primary" [disabled]="submitting()">
            {{ submitting() ? 'Submitting...' : 'Submit feedback' }}
          </button>
        </form>

        <aside class="rounded-2xl border border-stroke bg-surface-raised/70 p-5 text-sm text-muted">
          <h2 class="text-base font-semibold text-content">What to include</h2>
          <ul class="mt-3 space-y-2">
            <li>What you were trying to do.</li>
            <li>What went wrong or what could be improved.</li>
            <li>Any follow-up contact details, if you want a response.</li>
          </ul>
          <div class="mt-5 rounded-xl border border-stroke/70 bg-surface/70 p-4">
            <p class="text-xs font-semibold uppercase tracking-[0.12em] text-accent">Privacy note</p>
            <p class="mt-2 text-xs leading-relaxed">
              We store your IP address, browser details, and page source with this request to help investigate issues
              and prevent misuse. Contact details are optional.
            </p>
          </div>
        </aside>
      </div>
    </div>
  `,
})
export default class FeedbackComponent {
  private feedback = inject(FeedbackService);

  name = '';
  emailOrPhone = '';
  issue = '';
  submitting = signal(false);
  success = signal(false);
  error = signal('');

  submit(): void {
    const name = this.name.trim();
    const issue = this.issue.trim();
    const emailOrPhone = this.emailOrPhone.trim();

    this.success.set(false);
    this.error.set('');

    if (!name || !issue) {
      this.error.set('Please enter your name and describe the issue or suggestion.');
      return;
    }

    this.submitting.set(true);
    this.feedback
      .submitAppFeedback({
        name,
        issue,
        email_or_phone: emailOrPhone || undefined,
        page_url: window.location.href,
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.success.set(true);
          this.issue = '';
        },
        error: () => {
          this.submitting.set(false);
          this.error.set('Could not submit feedback. Please try again after a moment.');
        },
      });
  }
}

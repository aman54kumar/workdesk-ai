import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-output-feedback',
  standalone: true,
  imports: [FormsModule],
  template: `
    @if (visible) {
      <div class="output-feedback">
        <div class="output-feedback-row">
          <span class="text-xs text-muted">Was this helpful?</span>
          <div class="flex items-center gap-1.5">
            <button
              type="button"
              class="feedback-thumb"
              [disabled]="submitted()"
              aria-label="Yes, helpful"
              (click)="submit('up')"
            >
              👍
            </button>
            <button
              type="button"
              class="feedback-thumb"
              [disabled]="submitted()"
              aria-label="No, not helpful"
              (click)="showComment.set(true)"
            >
              👎
            </button>
          </div>
        </div>

        @if (showComment() && !submitted()) {
          <div class="mt-2 flex flex-wrap gap-2">
            <input
              type="text"
              class="field-input min-w-[200px] flex-1 text-xs"
              placeholder="Optional: what went wrong?"
              [(ngModel)]="comment"
              (keydown.enter)="submit('down')"
            />
            <button type="button" class="btn-secondary text-xs" (click)="submit('down')">
              Submit
            </button>
          </div>
        }

        @if (submitted()) {
          <p class="mt-2 text-xs text-muted">Thanks for your feedback.</p>
        }
      </div>
    }
  `,
  styles: `
    .output-feedback {
      border-top: 1px solid rgb(var(--c-stroke) / 0.6);
      padding: 0.75rem 1rem 1rem;
    }

    .output-feedback-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
    }

    .feedback-thumb {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2rem;
      height: 2rem;
      border-radius: 0.5rem;
      border: 1px solid rgb(var(--c-stroke));
      font-size: 0.875rem;
      line-height: 1;
      transition: background-color 0.15s ease, border-color 0.15s ease;
    }

    .feedback-thumb:hover:not(:disabled) {
      background-color: rgb(var(--c-surface-raised));
    }

    .feedback-thumb:disabled {
      opacity: 0.55;
      cursor: default;
    }
  `,
})
export class OutputFeedbackComponent implements OnChanges {
  private http = inject(HttpClient);

  @Input() visible = false;
  @Input() taskType = '';
  @Input() model = '';
  @Output() submittedChange = new EventEmitter<void>();

  showComment = signal(false);
  submitted = signal(false);
  comment = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible']?.currentValue && !changes['visible']?.previousValue) {
      this.submitted.set(false);
      this.showComment.set(false);
      this.comment = '';
    }
  }

  submit(rating: 'up' | 'down'): void {
    if (this.submitted()) return;
    this.http
      .post(`${environment.apiUrl}/feedback`, {
        task_type: this.taskType,
        model: this.model,
        rating,
        comment: rating === 'down' ? this.comment.trim() || null : null,
      })
      .subscribe({
        next: () => {
          this.submitted.set(true);
          this.submittedChange.emit();
        },
        error: () => this.submitted.set(true),
      });
  }
}

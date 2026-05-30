import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CopyButtonComponent } from '../copy-button/copy-button.component';
import { QueueStatusComponent } from '../queue-status/queue-status.component';
import { OutputFeedbackComponent } from '../output-feedback/output-feedback.component';

@Component({
  selector: 'app-streaming-output',
  standalone: true,
  imports: [CommonModule, CopyButtonComponent, QueueStatusComponent, OutputFeedbackComponent],
  template: `
    <app-queue-status
      [position]="queuePosition"
      [etaS]="queueEta"
    />

  @if (errorMessage) {
    <div class="mb-4 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
      <p>{{ errorMessage }}</p>
      @if (showRetry) {
        <button type="button" class="btn-secondary mt-2 text-xs" (click)="retry.emit()">Retry</button>
      }
    </div>
  }

    <div class="output-card">
      <div class="output-card-header">
        <div class="flex items-center gap-2">
          <svg class="h-3.5 w-3.5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
          </svg>
          <span class="text-[12px] font-medium text-muted">AI Output</span>
          @if (loading && queuePosition === 0) {
            <span class="flex items-center gap-1.5 text-[11px] text-accent">
              <span class="spinner"></span>
              Generating…
            </span>
          }
          @if (cacheHit && !loading) {
            <span class="flex items-center gap-1 rounded-full border border-stroke/70 bg-canvas/60 px-2 py-0.5 text-[10px] text-faint">
              <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M13 10V3L4 14h7v7l9-11h-7z"/>
              </svg>
              Cached
            </span>
          }
        </div>

        @if (text && !loading) {
          <div class="flex items-center gap-1.5">
            <app-copy-button [text]="text" />
            <button type="button" (click)="regenerate.emit()" class="btn-ghost">
              Regenerate
            </button>
          </div>
        }
      </div>

      <div class="p-4 font-mono text-sm text-content">
        @if (!text && !loading && queuePosition === 0) {
          <span class="output-placeholder">Output will appear here...</span>
        }

        @if (loading && !text && queuePosition === 0) {
          <span class="output-thinking">Thinking…</span>
        }

        @if (text) {
          <div class="whitespace-pre-wrap leading-relaxed" [class.streaming-cursor]="loading">{{ text }}</div>
        }
      </div>

      <app-output-feedback
        [visible]="!!text && !loading && !!taskType"
        [taskType]="taskType"
        [model]="model"
      />
    </div>
  `,
})
export class StreamingOutputComponent {
  @Input() text = '';
  @Input() loading = false;
  @Input() cacheHit = false;
  @Input() queuePosition = 0;
  @Input() queueEta = 0;
  @Input() errorMessage = '';
  @Input() showRetry = true;
  @Input() taskType = '';
  @Input() model = '';
  @Output() regenerate = new EventEmitter<void>();
  @Output() cancelQueue = new EventEmitter<void>();
  @Output() retry = new EventEmitter<void>();
}

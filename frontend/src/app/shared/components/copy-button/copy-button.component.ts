import { Component, Input } from '@angular/core';
import { copyToClipboard } from '../../../core/utils/clipboard';

@Component({
  selector: 'app-copy-button',
  standalone: true,
  template: `
    <button
      type="button"
      (click)="copy()"
      class="copy-btn btn-ghost"
      [class.copy-btn-success]="copied"
      [class.copy-btn-error]="failed"
      [attr.aria-label]="copied ? 'Copied to clipboard' : failed ? 'Copy failed' : 'Copy to clipboard'"
    >
      @if (copied) {
        <svg class="copy-btn-icon copy-btn-icon-pop" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.25"
            d="M5 13l4 4L19 7"/>
        </svg>
        <span>Copied</span>
      } @else if (failed) {
        <svg class="copy-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <span>Failed</span>
      } @else {
        <svg class="copy-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
        </svg>
        <span>Copy</span>
      }
      <span class="sr-only" aria-live="polite">
        @if (copied) { Copied to clipboard }
        @if (failed) { Copy failed }
      </span>
    </button>
  `,
  styles: [`
    .copy-btn {
      min-width: 5.25rem;
      justify-content: center;
      transition:
        color 0.2s ease,
        border-color 0.2s ease,
        background-color 0.2s ease,
        box-shadow 0.2s ease;
    }

    .copy-btn-icon {
      width: 0.875rem;
      height: 0.875rem;
      flex-shrink: 0;
    }

    .copy-btn-success {
      color: #059669;
      border-color: rgb(16 185 129 / 0.45);
      background: rgb(16 185 129 / 0.1);
      box-shadow: 0 0 0 1px rgb(16 185 129 / 0.08);
    }

    :host-context(.dark) .copy-btn-success,
    :host-context(html.dark) .copy-btn-success {
      color: #6ee7b7;
      border-color: rgb(52 211 153 / 0.4);
      background: rgb(16 185 129 / 0.14);
    }

    .copy-btn-error {
      color: #dc2626;
      border-color: rgb(239 68 68 / 0.45);
      background: rgb(239 68 68 / 0.08);
    }

    :host-context(.dark) .copy-btn-error,
    :host-context(html.dark) .copy-btn-error {
      color: #fca5a5;
      border-color: rgb(248 113 113 / 0.4);
      background: rgb(239 68 68 / 0.12);
    }

    .copy-btn-icon-pop {
      animation: copy-pop 0.38s cubic-bezier(0.34, 1.4, 0.64, 1);
    }

    @keyframes copy-pop {
      0% {
        opacity: 0;
        transform: scale(0.45) rotate(-8deg);
      }
      55% {
        opacity: 1;
        transform: scale(1.18) rotate(0deg);
      }
      100% {
        transform: scale(1) rotate(0deg);
      }
    }
  `],
})
export class CopyButtonComponent {
  @Input() text = '';
  @Input() html = '';

  copied = false;
  failed = false;

  private resetTimer: ReturnType<typeof setTimeout> | null = null;

  async copy(): Promise<void> {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }

    this.copied = false;
    this.failed = false;

    const html = this.html?.trim() || undefined;
    const ok = await copyToClipboard(this.text, html);

    if (ok) {
      this.copied = true;
      this.resetTimer = setTimeout(() => {
        this.copied = false;
        this.resetTimer = null;
      }, 2000);
      return;
    }

    this.failed = true;
    this.resetTimer = setTimeout(() => {
      this.failed = false;
      this.resetTimer = null;
    }, 2500);
  }
}

import { Component, ElementRef, inject, OnInit, signal, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { GenerateService } from '../../../core/services/generate.service';
import { HistoryRestoreService } from '../../../core/services/history-restore.service';
import { HistoryService } from '../../../core/services/history.service';
import { ThemeService } from '../../../core/services/theme.service';
import { startToolGeneration } from '../../../core/utils/tool-generation';
import { GenerationActionsComponent } from '../../../shared/components/generation-actions/generation-actions.component';
import { QueueStatusComponent } from '../../../shared/components/queue-status/queue-status.component';
import { CopyButtonComponent } from '../../../shared/components/copy-button/copy-button.component';
import { OutputFeedbackComponent } from '../../../shared/components/output-feedback/output-feedback.component';

@Component({
  selector: 'app-email-composer',
  standalone: true,
  imports: [FormsModule, GenerationActionsComponent, QueueStatusComponent, CopyButtonComponent, OutputFeedbackComponent],
  template: `
    <div class="page-wrap">
      <h2 class="page-title">Email Composer</h2>
      <p class="page-desc">Write professional emails from rough notes</p>

      <div class="grid grid-cols-1 lg:grid-cols-5 gap-5 mb-4">
        <!-- Input -->
        <div class="lg:col-span-3 flex flex-col gap-1">
          <label class="field-label">What do you want to say?
            <span class="font-normal text-faint">(rough notes are fine)</span>
          </label>
          <textarea
            [(ngModel)]="input"
            (ngModelChange)="onInputChange()"
            rows="8"
            placeholder="e.g. tell client go live is delayed 2 weeks, issue is on their side but don't blame them"
            class="field-input"
          ></textarea>
          @if (showValidation && !input.trim()) {
            <p class="field-error">Please enter some notes before generating.</p>
          }
        </div>

        <!-- Options -->
        <div class="lg:col-span-2 flex flex-col gap-4">
          <div>
            <label class="field-label" for="emailTone">Tone</label>
            <select id="emailTone" [(ngModel)]="tone" name="tone"
              class="field-input">
              <option value="Formal">Formal</option>
              <option value="Internal & team">Internal &amp; Team</option>
              <option value="Government & official">Government &amp; Official</option>
            </select>
          </div>
          <div>
            <p class="field-label mb-2">Length</p>
            <div class="flex flex-col gap-2">
              @for (opt of ['Standard', 'Brief']; track opt) {
                <button type="button"
                  (click)="length = opt"
                  [class.option-pill-active]="length === opt"
                  [class.option-pill]="length !== opt">
                  {{ opt }}
                </button>
              }
            </div>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex gap-2 mb-5">
        <app-generation-actions
          label="Generate"
          [loading]="loading()"
          (generate)="onGenerate()"
          (stop)="onCancelQueue()"
        />
        <button type="button" (click)="onClear()" class="btn-secondary">Clear</button>
      </div>

      <app-queue-status
        [position]="queuePosition()"
        [etaS]="queueEta()"
      />

      @if (errorMessage()) {
        <div class="mb-4 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          <p>{{ errorMessage() }}</p>
          <button type="button" class="btn-secondary mt-2 text-xs" (click)="onGenerate()">Retry</button>
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
            @if (loading() && !rawText()) {
              <span class="flex items-center gap-1.5 text-[11px] text-accent">
                <span class="spinner"></span>
                Generating…
              </span>
            }
            @if (cacheHit() && !loading()) {
              <span class="flex items-center gap-1 rounded-full border border-stroke/70 bg-canvas/60 px-2 py-0.5 text-[10px] text-faint">
                <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M13 10V3L4 14h7v7l9-11h-7z"/>
                </svg>
                Cached
              </span>
            }
          </div>

          @if (rawText() && !loading()) {
            <div class="flex items-center gap-1.5">
              <app-copy-button [text]="rawText()" [html]="copyHtml()" />
              <button type="button" (click)="onRegenerate()" class="btn-ghost">
                Regenerate
              </button>
            </div>
          }
        </div>

        @if (loading() || (!rawText() && !loading())) {
          <div class="p-4 text-sm text-content" style="font-family: Georgia, serif; line-height: 1.7">
            @if (!rawText() && !loading()) {
              <span class="output-placeholder">Output will appear here...</span>
            }
            @if (loading() && !rawText()) {
              <span class="output-thinking">Thinking...</span>
            }
            @if (rawText()) {
              <div class="whitespace-pre-wrap">{{ rawText() }}</div>
            }
          </div>
        }

        @if (rawText() && !loading()) {
          <div #richOutput
            class="p-5 text-sm text-content leading-relaxed"
            style="font-family: Georgia, serif; line-height: 1.8"
            [innerHTML]="formattedHtml()">
          </div>
        }

        <app-output-feedback
          [visible]="!!rawText() && !loading()"
          taskType="email_composer"
          [model]="lastModel()"
        />
      </div>
    </div>
  `,
})
export default class EmailComposerComponent implements OnInit {
  private gs = inject(GenerateService);
  private history = inject(HistoryService);
  private restore = inject(HistoryRestoreService);
  private sanitizer = inject(DomSanitizer);
  private theme = inject(ThemeService);

  @ViewChild('richOutput') richOutput?: ElementRef<HTMLDivElement>;

  input = '';
  tone = 'Formal';
  length = 'Standard';

  rawText = signal('');
  loading = signal(false);
  errorMessage = signal('');
  queuePosition = signal(0);
  queueEta = signal(0);
  lastModel = signal('');
  cacheHit = signal(false);
  showValidation = false;
  private cancelGen: (() => void) | null = null;

  ngOnInit(): void {
    this.gs.loadLimits();
    const entry = this.restore.consume('email_composer');
    if (entry) this.rawText.set(entry.output);
  }

  formattedHtml(): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(this.toHtml(this.rawText()));
  }

  copyHtml(): string {
    return this.toHtml(this.rawText());
  }

  private toHtml(text: string): string {
    const lines = text.split('\n');
    const dark = this.theme.mode() === 'dark';
    const bodyColor = dark ? '#f1f5f9' : '#1e293b';
    const accentColor = dark ? '#a5b4fc' : '#6366f1';
    const mutedColor = dark ? '#94a3b8' : '#6b7280';
    const S = `font-family:Georgia,serif;line-height:1.8;color:${bodyColor};font-weight:normal`;
    const parts: string[] = [];

    // Collect consecutive numbered/bulleted lines into a single list block
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      // ── Subject line ──────────────────────────────────────────────
      if (/^Subject:/i.test(trimmed)) {
        const label = `<span style="color:${accentColor};font-weight:600">Subject:</span>`;
        const rest = this.esc(trimmed.slice(8));
        parts.push(
          `<p style="margin:0 0 14px 0;font-size:14px;font-weight:600;color:${bodyColor}">${label}${rest}</p>`,
        );
        i++; continue;
      }

      // ── Numbered list item: "1. " / "1) " ─────────────────────────
      if (/^\d+[.)]\s/.test(trimmed)) {
        const items: string[] = [];
        while (i < lines.length && /^\d+[.)]\s/.test(lines[i].trim())) {
          items.push(`<li style="margin:0 0 4px 0">${this.esc(lines[i].trim().replace(/^\d+[.)]\s+/, ''))}</li>`);
          i++;
        }
        parts.push(`<ol style="margin:8px 0 12px 0;padding-left:22px">${items.join('')}</ol>`);
        continue;
      }

      // ── Bullet list item: "- " / "• " / "* " ─────────────────────
      if (/^[-•*]\s/.test(trimmed)) {
        const items: string[] = [];
        while (i < lines.length && /^[-•*]\s/.test(lines[i].trim())) {
          items.push(`<li style="margin:0 0 4px 0">${this.esc(lines[i].trim().slice(2))}</li>`);
          i++;
        }
        parts.push(`<ul style="margin:8px 0 12px 0;padding-left:22px;list-style:disc">${items.join('')}</ul>`);
        continue;
      }

      // ── Blank line → vertical space ───────────────────────────────
      if (trimmed === '') {
        // Only add spacer if not already after a block element
        if (parts.length && !parts[parts.length - 1].startsWith('<ol') && !parts[parts.length - 1].startsWith('<ul')) {
          parts.push(`<div style="height:10px"></div>`);
        }
        i++; continue;
      }

      // ── Salutation: "Dear …," ──────────────────────────────────────
      if (/^Dear\b/i.test(trimmed)) {
        parts.push(`<p style="margin:0 0 10px 0;font-weight:600">${this.esc(trimmed)}</p>`);
        i++; continue;
      }

      // ── Closing lines: "Sincerely," / "Regards," / "Thanks," etc. ─
      if (/^(sincerely|regards|best regards|warm regards|thank you|thanks|yours|with regards)/i.test(trimmed)) {
        parts.push(`<p style="margin:12px 0 4px 0;font-weight:600">${this.esc(trimmed)}</p>`);
        i++; continue;
      }

      // ── Placeholder token: [Your Name] ───────────────────────────
      if (/^\[.+\]$/.test(trimmed)) {
        parts.push(`<p style="margin:0 0 4px 0;color:${mutedColor};font-style:italic">${this.esc(trimmed)}</p>`);
        i++; continue;
      }

      // ── Normal paragraph line ─────────────────────────────────────
      parts.push(`<p style="margin:0 0 6px 0">${this.esc(trimmed)}</p>`);
      i++;
    }

    return `<div style="${S}">${parts.join('')}</div>`;
  }

  private esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  onInputChange(): void {
    this.showValidation = false;
  }

  onRegenerate(): void {
    this.onGenerate(true);
  }

  onGenerate(skipCache = false): void {
    this.showValidation = true;
    if (!this.input.trim()) return;
    this.cancelGen = startToolGeneration(
      this.gs,
      this.history,
      'email_composer',
      {
        input: this.input.trim(),
        tone: this.tone,
        length: this.length,
      },
      {
        outputText: this.rawText,
        loading: this.loading,
        cacheHit: this.cacheHit,
        errorMessage: this.errorMessage,
        queuePosition: this.queuePosition,
        queueEta: this.queueEta,
        lastModel: this.lastModel,
      },
      skipCache,
    );
  }

  onCancelQueue(): void {
    this.cancelGen?.();
    this.cancelGen = null;
    this.loading.set(false);
    this.queuePosition.set(0);
    this.queueEta.set(0);
  }

  onClear(): void {
    this.onCancelQueue();
    this.input = '';
    this.tone = 'Formal';
    this.length = 'Standard';
    this.rawText.set('');
    this.errorMessage.set('');
    this.cacheHit.set(false);
    this.showValidation = false;
  }
}

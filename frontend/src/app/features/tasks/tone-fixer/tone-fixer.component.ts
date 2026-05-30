import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GenerateService } from '../../../core/services/generate.service';
import { HistoryRestoreService } from '../../../core/services/history-restore.service';
import { HistoryService } from '../../../core/services/history.service';
import { startToolGeneration } from '../../../core/utils/tool-generation';
import { GenerationActionsComponent } from '../../../shared/components/generation-actions/generation-actions.component';
import { StreamingOutputComponent } from '../../../shared/components/streaming-output/streaming-output.component';

const TONE_OPTIONS = [
  'Formal',
  'Internal & team',
  'Government & official',
  'Concise',
  'Natural & human',
];

@Component({
  selector: 'app-tone-fixer',
  standalone: true,
  imports: [FormsModule, GenerationActionsComponent, StreamingOutputComponent],
  template: `
    <div class="page-wrap">
      <h2 class="page-title">Tone Fixer</h2>
      <p class="page-desc">Rewrite text for a different tone while keeping the same meaning and facts</p>

      <div class="grid grid-cols-1 lg:grid-cols-5 gap-5 mb-4">
        <div class="lg:col-span-3 flex flex-col gap-1">
          <label class="field-label">Text to rewrite</label>
          <textarea [(ngModel)]="input" (ngModelChange)="onInputChange()" rows="9"
            placeholder="Paste the text you want to rewrite..."
            class="field-input">
          </textarea>
          @if (showValidation && !input.trim()) {
            <p class="field-error">Please enter some text before rewriting.</p>
          }
        </div>

        <div class="lg:col-span-2">
          <p class="field-label mb-2">Target tone</p>
          <div class="flex flex-col gap-2">
            @for (opt of toneOptions; track opt) {
              <button type="button"
                (click)="toneInstruction = opt"
                [class.option-pill-active]="toneInstruction === opt"
                [class.option-pill]="toneInstruction !== opt">
                {{ opt }}
              </button>
            }
          </div>
        </div>
      </div>

      <div class="flex gap-2 mb-5">
        <app-generation-actions
          label="Rewrite"
          [loading]="loading()"
          (generate)="onGenerate()"
          (stop)="onCancelQueue()"
        />
        <button type="button" (click)="onClear()" class="btn-secondary">Clear</button>
      </div>

      <app-streaming-output
        [text]="outputText()" [loading]="loading()" [cacheHit]="cacheHit()"
        [queuePosition]="queuePosition()" [queueEta]="queueEta()" [errorMessage]="errorMessage()"
        taskType="tone_fixer" [model]="lastModel()"
        (regenerate)="onGenerate()" (retry)="onGenerate()" (cancelQueue)="onCancelQueue()"
      />
    </div>
  `,
})
export default class ToneFixerComponent implements OnInit {
  private gs = inject(GenerateService);
  private history = inject(HistoryService);
  private restore = inject(HistoryRestoreService);

  input = '';
  toneOptions = TONE_OPTIONS;
  toneInstruction = TONE_OPTIONS[0];
  outputText = signal('');
  loading = signal(false);
  cacheHit = signal(false);
  errorMessage = signal('');
  queuePosition = signal(0);
  queueEta = signal(0);
  lastModel = signal('');
  showValidation = false;
  private cancelGen: (() => void) | null = null;

  ngOnInit(): void {
    this.gs.loadLimits();
    const entry = this.restore.consume('tone_fixer');
    if (entry) this.outputText.set(entry.output);
  }

  onInputChange(): void {
    this.showValidation = false;
  }

  onGenerate(): void {
    this.showValidation = true;
    if (!this.input.trim()) return;
    this.cancelGen = startToolGeneration(
      this.gs, this.history, 'tone_fixer',
      { input: this.input.trim(), tone_instruction: this.toneInstruction },
      {
        outputText: this.outputText, loading: this.loading, cacheHit: this.cacheHit,
        errorMessage: this.errorMessage, queuePosition: this.queuePosition,
        queueEta: this.queueEta, lastModel: this.lastModel,
      },
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
    this.toneInstruction = TONE_OPTIONS[0];
    this.outputText.set('');
    this.errorMessage.set('');
    this.cacheHit.set(false);
    this.showValidation = false;
  }
}

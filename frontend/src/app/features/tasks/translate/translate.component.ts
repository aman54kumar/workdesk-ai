import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GenerateService } from '../../../core/services/generate.service';
import { HistoryRestoreService } from '../../../core/services/history-restore.service';
import { HistoryService } from '../../../core/services/history.service';
import { startToolGeneration } from '../../../core/utils/tool-generation';
import { GenerationActionsComponent } from '../../../shared/components/generation-actions/generation-actions.component';
import { StreamingOutputComponent } from '../../../shared/components/streaming-output/streaming-output.component';

@Component({
  selector: 'app-translate',
  standalone: true,
  imports: [FormsModule, GenerationActionsComponent, StreamingOutputComponent],
  template: `
    <div class="page-wrap">
      <h2 class="page-title">Translate</h2>
      <p class="page-desc">Translate workplace text to English, Hindi, or Gujarati with natural business phrasing</p>

      <div class="grid grid-cols-1 lg:grid-cols-5 gap-5 mb-4">
        <div class="lg:col-span-3 flex flex-col gap-1">
          <label class="field-label">Text to translate</label>
          <textarea [(ngModel)]="input" (ngModelChange)="onInputChange()" rows="9"
            placeholder="Paste the text you want to translate..."
            class="field-input">
          </textarea>
          @if (showValidation && !input.trim()) {
            <p class="field-error">Please enter some text before translating.</p>
          }
        </div>

        <div class="lg:col-span-2">
          <label class="field-label mb-2">Translate to</label>
          <div class="flex flex-col gap-2">
            @for (lang of languages; track lang) {
              <button type="button" (click)="language = lang"
                [class.option-pill-active]="language === lang"
                [class.option-pill]="language !== lang">
                {{ lang }}
              </button>
            }
          </div>
        </div>
      </div>

      <div class="flex gap-2 mb-5">
        <app-generation-actions
          label="Translate"
          [loading]="loading()"
          (generate)="onGenerate()"
          (stop)="onCancelQueue()"
        />
        <button type="button" (click)="onClear()" class="btn-secondary">Clear</button>
      </div>

      <app-streaming-output
        [text]="outputText()"
        [loading]="loading()"
        [cacheHit]="cacheHit()"
        [queuePosition]="queuePosition()"
        [queueEta]="queueEta()"
        [errorMessage]="errorMessage()"
        taskType="translate"
        [model]="lastModel()"
        (regenerate)="onGenerate()"
        (retry)="onGenerate()"
        (cancelQueue)="onCancelQueue()"
      />
    </div>
  `,
})
export default class TranslateComponent implements OnInit {
  private gs = inject(GenerateService);
  private history = inject(HistoryService);
  private restore = inject(HistoryRestoreService);

  input = '';
  languages = ['English', 'Hindi', 'Gujarati'];
  language = 'Hindi';
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
    const entry = this.restore.consume('translate');
    if (entry) this.outputText.set(entry.output);
  }

  onInputChange(): void {
    this.showValidation = false;
  }

  onGenerate(): void {
    this.showValidation = true;
    if (!this.input.trim()) return;
    this.cancelGen = startToolGeneration(
      this.gs,
      this.history,
      'translate',
      { input: this.input.trim(), language: this.language },
      {
        outputText: this.outputText,
        loading: this.loading,
        cacheHit: this.cacheHit,
        errorMessage: this.errorMessage,
        queuePosition: this.queuePosition,
        queueEta: this.queueEta,
        lastModel: this.lastModel,
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
    this.language = 'Hindi';
    this.outputText.set('');
    this.errorMessage.set('');
    this.cacheHit.set(false);
    this.showValidation = false;
  }
}

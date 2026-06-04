import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GenerateService } from '../../../core/services/generate.service';
import { HistoryRestoreService } from '../../../core/services/history-restore.service';
import { HistoryService } from '../../../core/services/history.service';
import { restoreFromHistory } from '../../../core/utils/restore-tool-history';
import { startToolGeneration } from '../../../core/utils/tool-generation';
import { LlmSourceBadgeComponent } from '../../../shared/components/llm-source-badge/llm-source-badge.component';
import { GenerationActionsComponent } from '../../../shared/components/generation-actions/generation-actions.component';
import { StreamingOutputComponent } from '../../../shared/components/streaming-output/streaming-output.component';

@Component({
  selector: 'app-de-ai-text',
  standalone: true,
  imports: [FormsModule, GenerationActionsComponent, StreamingOutputComponent, LlmSourceBadgeComponent],
  template: `
    <div class="page-wrap">
      <h2 class="page-title">De-AI Text</h2>
      <p class="page-desc !mb-2">Remove AI-sounding language to make text feel natural and human</p>

      <p class="text-xs text-faint mb-5 italic">
        Use this to remove the "written by AI" feel from proposals, emails, or documentation.
      </p>

      <div class="mb-4">
        <label class="field-label">Paste the AI-sounding text</label>
        <textarea [(ngModel)]="input" (ngModelChange)="onInputChange()" rows="9"
          placeholder="Paste the text that sounds too AI-generated here..."
          class="field-input">
        </textarea>
        @if (showValidation && !input.trim()) {
          <p class="field-error">Please paste some text before rewriting.</p>
        }
      </div>

      <app-llm-source-badge />

      <div class="flex gap-2 mb-5">
        <app-generation-actions
          label="Make it Human"
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
        taskType="de_ai_text"
        [model]="lastModel()"
        (regenerate)="onGenerate()"
        (retry)="onGenerate()"
        (cancelQueue)="onCancelQueue()"
      />
    </div>
  `,
})
export default class DeAiTextComponent implements OnInit {
  private gs = inject(GenerateService);
  private history = inject(HistoryService);
  private restore = inject(HistoryRestoreService);

  input = '';
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
    restoreFromHistory(this.restore.consume('de_ai_text'), {
      applyInputs: (v) => {
        if (v['input'] != null) this.input = v['input'];
      },
      setOutput: (t) => this.outputText.set(t),
    });
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
      'de_ai_text',
      { input: this.input.trim() },
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
    this.outputText.set('');
    this.errorMessage.set('');
    this.cacheHit.set(false);
    this.showValidation = false;
  }
}

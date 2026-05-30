import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GenerateService } from '../../../core/services/generate.service';
import { HistoryRestoreService } from '../../../core/services/history-restore.service';
import { HistoryService } from '../../../core/services/history.service';
import { startToolGeneration } from '../../../core/utils/tool-generation';
import { GenerationActionsComponent } from '../../../shared/components/generation-actions/generation-actions.component';
import { StreamingOutputComponent } from '../../../shared/components/streaming-output/streaming-output.component';

@Component({
  selector: 'app-eligibility-check',
  standalone: true,
  imports: [FormsModule, GenerationActionsComponent, StreamingOutputComponent],
  template: `
    <div class="page-wrap">
      <h2 class="page-title">Eligibility Check</h2>
      <p class="page-desc !mb-2">Check RFP eligibility criteria against your company credentials</p>

      <div class="alert-banner">
        <p class="alert-banner-text">This task uses the quality model — response may take longer than usual.</p>
      </div>

      <div class="grid grid-cols-1 gap-4 mb-4">
        <div>
          <label class="field-label">Eligibility Criteria</label>
          <textarea [(ngModel)]="criteria" (ngModelChange)="onInputChange()" rows="6" class="field-input"
            placeholder="Paste the eligibility criteria from the tender document here..."></textarea>
          @if (showValidation && !criteria.trim()) {
            <p class="field-error">Please paste the eligibility criteria before checking eligibility.</p>
          }
        </div>
        <div>
          <label class="field-label">Company Credentials</label>
          <textarea [(ngModel)]="credentials" (ngModelChange)="onInputChange()" rows="6" class="field-input"
            placeholder="Paste your company's credentials and relevant experience here..."></textarea>
          @if (showValidation && !credentials.trim()) {
            <p class="field-error">Please paste the company credentials before checking eligibility.</p>
          }
        </div>
      </div>

      <div class="flex gap-2 mb-5">
        <app-generation-actions
          label="Check Eligibility"
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
        taskType="eligibility_check"
        [model]="lastModel()"
        (regenerate)="onGenerate()"
        (retry)="onGenerate()"
        (cancelQueue)="onCancelQueue()"
      />
    </div>
  `,
})
export default class EligibilityCheckComponent implements OnInit {
  private gs = inject(GenerateService);
  private history = inject(HistoryService);
  private restore = inject(HistoryRestoreService);

  criteria = '';
  credentials = '';
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
    const entry = this.restore.consume('eligibility_check');
    if (entry) this.outputText.set(entry.output);
  }

  onInputChange(): void {
    this.showValidation = false;
  }

  onGenerate(): void {
    this.showValidation = true;
    if (!this.criteria.trim() || !this.credentials.trim()) return;
    this.cancelGen = startToolGeneration(
      this.gs,
      this.history,
      'eligibility_check',
      { criteria: this.criteria.trim(), credentials: this.credentials.trim() },
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
    this.criteria = '';
    this.credentials = '';
    this.outputText.set('');
    this.errorMessage.set('');
    this.cacheHit.set(false);
    this.showValidation = false;
  }
}

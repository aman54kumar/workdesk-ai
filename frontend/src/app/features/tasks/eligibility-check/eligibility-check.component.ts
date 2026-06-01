import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GenerateService } from '../../../core/services/generate.service';
import { HistoryRestoreService } from '../../../core/services/history-restore.service';
import { HistoryService } from '../../../core/services/history.service';
import { restoreFromHistory } from '../../../core/utils/restore-tool-history';
import { startToolGeneration } from '../../../core/utils/tool-generation';
import { GenerationActionsComponent } from '../../../shared/components/generation-actions/generation-actions.component';
import { CompanyProfileViewerComponent } from '../../../shared/components/company-profile-viewer/company-profile-viewer.component';
import { StreamingOutputComponent } from '../../../shared/components/streaming-output/streaming-output.component';
import type { CompanyProfileSectionPublic } from '../../../core/services/generate.service';

@Component({
  selector: 'app-eligibility-check',
  standalone: true,
  imports: [FormsModule, GenerationActionsComponent, CompanyProfileViewerComponent, StreamingOutputComponent],
  template: `
    <div class="page-wrap">
      <h2 class="page-title">Eligibility Check</h2>
      <p class="page-desc !mb-2">
        Compare tender eligibility criteria against your company credentials.
        @if (profileAvailable()) {
          The admin-maintained company profile is used automatically — you only need to paste the RFP criteria below.
        }
      </p>

      <div class="alert-banner">
        <p class="alert-banner-text">This task uses the quality model — response may take longer than usual.</p>
      </div>

      <div class="grid grid-cols-1 gap-4 mb-4">
        <div>
          <label class="field-label">Eligibility criteria</label>
          <textarea
            [(ngModel)]="criteria"
            (ngModelChange)="onInputChange()"
            rows="6"
            class="field-input"
            placeholder="Paste the eligibility criteria from the tender document here..."
          ></textarea>
          @if (showValidation && !criteria.trim()) {
            <p class="field-error">Please paste the eligibility criteria before checking.</p>
          }
        </div>

        @if (profileAvailable()) {
          <div class="space-y-3">
          <div class="rounded-xl border border-accent/25 bg-accent/5 px-4 py-3">
            <p class="text-sm font-medium text-content">Using company profile</p>
            <p class="mt-1 text-xs leading-relaxed text-muted">
              This check uses the admin-maintained profile automatically.
              Nothing you add below updates that profile.
            </p>
            <label class="mt-3 flex cursor-pointer items-start gap-2 text-sm text-content">
              <input
                type="checkbox"
                class="mt-0.5 rounded border-stroke text-accent focus:ring-accent/30"
                [(ngModel)]="useExtraCredentials"
                (ngModelChange)="onInputChange()"
              />
              <span>Add extra credentials or context for <strong>this check only</strong> (optional)</span>
            </label>
          </div>

          @if (profileContent().length) {
            <app-company-profile-viewer [sections]="profileContent()" />
          }

          </div>

          @if (useExtraCredentials) {
            <div>
              <label class="field-label">Additional credentials (this run only)</label>
              <textarea
                [(ngModel)]="credentials"
                (ngModelChange)="onInputChange()"
                rows="5"
                class="field-input"
                placeholder="e.g. a specific project win, JV partner details, or figures not in the company profile..."
              ></textarea>
            </div>
          }
        } @else {
          <div>
            <label class="field-label">Company credentials</label>
            <p class="mb-2 text-xs text-muted">
              No company profile is configured yet. Paste credentials here, or ask an admin to set up
              Company profile so this step is automatic.
            </p>
            <textarea
              [(ngModel)]="credentials"
              (ngModelChange)="onInputChange()"
              rows="6"
              class="field-input"
              placeholder="Paste your company's credentials and relevant experience here..."
            ></textarea>
            @if (showValidation && !credentials.trim()) {
              <p class="field-error">Please paste company credentials, or ask an admin to configure the company profile.</p>
            }
          </div>
        }
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
  useExtraCredentials = false;
  profileAvailable = signal(false);
  profileContent = signal<CompanyProfileSectionPublic[]>([]);
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
    this.gs
      .fetchCompanyProfileStatus()
      .then((status) => {
        this.profileAvailable.set(status.available);
        this.profileContent.set(status.sections ?? []);
      })
      .catch(() => {
        this.profileAvailable.set(false);
        this.profileContent.set([]);
      });

    restoreFromHistory(this.restore.consume('eligibility_check'), {
      applyInputs: (v) => {
        if (v['criteria'] != null) this.criteria = v['criteria'];
        if (v['credentials'] != null) {
          this.credentials = v['credentials'];
          if (this.credentials.trim()) this.useExtraCredentials = true;
        }
      },
      setOutput: (t) => this.outputText.set(t),
    });
  }

  onInputChange(): void {
    this.showValidation = false;
  }

  onGenerate(): void {
    this.showValidation = true;
    const extra = this.useExtraCredentials ? this.credentials.trim() : '';
    if (!this.criteria.trim()) return;
    if (!this.profileAvailable() && !extra) return;

    this.cancelGen = startToolGeneration(
      this.gs,
      this.history,
      'eligibility_check',
      { criteria: this.criteria.trim(), credentials: extra },
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
    this.useExtraCredentials = false;
    this.outputText.set('');
    this.errorMessage.set('');
    this.cacheHit.set(false);
    this.showValidation = false;
  }
}

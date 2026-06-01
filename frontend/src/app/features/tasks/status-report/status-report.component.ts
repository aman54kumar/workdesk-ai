import { Component, inject, OnInit, signal } from '@angular/core';

import { FormsModule } from '@angular/forms';

import { GenerateService } from '../../../core/services/generate.service';

import { HistoryRestoreService } from '../../../core/services/history-restore.service';

import { HistoryService } from '../../../core/services/history.service';

import { restoreFromHistory } from '../../../core/utils/restore-tool-history';
import { startToolGeneration } from '../../../core/utils/tool-generation';

import { GenerationActionsComponent } from '../../../shared/components/generation-actions/generation-actions.component';

import { StreamingOutputComponent } from '../../../shared/components/streaming-output/streaming-output.component';



@Component({

  selector: 'app-status-report',

  standalone: true,

  imports: [FormsModule, GenerationActionsComponent, StreamingOutputComponent],

  template: `

    <div class="page-wrap">

      <h2 class="page-title">Status Report</h2>

      <p class="page-desc">Generate a formal weekly project status report</p>



      <!-- Meta fields -->

      <div class="mb-4">
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">

        <div>

          <label class="field-label">Project Name</label>

          <input type="text" [(ngModel)]="projectName" placeholder="e.g. Customer Portal — Phase 2"

            class="field-input" />

        </div>

        <div>

          <label class="field-label">Reporting Period</label>

          <input type="text" [(ngModel)]="period" placeholder="e.g. 20–26 May 2026"

            class="field-input" />

        </div>

        <div>

          <label class="field-label">Team / Department</label>

          <input type="text" [(ngModel)]="team" placeholder="e.g. Dev Team"

            class="field-input" />

        </div>

      </div>



      <!-- Updates textarea -->

      <div>
        <label class="field-label">Updates &amp; bullet points</label>

        <textarea [(ngModel)]="input" (ngModelChange)="onInputChange()" rows="7"

          placeholder="• Completed API integration&#10;• UAT started with client&#10;• Deployment planned for Friday&#10;• Risk: client UAT sign-off pending"

          class="field-input">

        </textarea>

        @if (showValidation && !input.trim()) {

          <p class="field-error">Please enter update notes before generating a report.</p>

        }

      </div>

      </div>



      <div class="flex gap-2 mb-5">

        <app-generation-actions
          label="Generate Report"
          [loading]="loading()"
          (generate)="onGenerate()"
          (stop)="onCancelQueue()"
        />

        <button type="button" (click)="onClear()"

          class="btn-secondary">

          Clear

        </button>

      </div>



      <app-streaming-output

        [text]="outputText()"

        [loading]="loading()"

        [cacheHit]="cacheHit()"

        [queuePosition]="queuePosition()"

        [queueEta]="queueEta()"

        [errorMessage]="errorMessage()"

        taskType="status_report"

        [model]="lastModel()"

        (regenerate)="onGenerate()"

        (retry)="onGenerate()"

        (cancelQueue)="onCancelQueue()"

      />

    </div>

  `,

})

export default class StatusReportComponent implements OnInit {

  private gs = inject(GenerateService);

  private history = inject(HistoryService);

  private restore = inject(HistoryRestoreService);



  input = '';

  projectName = '';

  period = '';

  team = '';

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

    restoreFromHistory(this.restore.consume('status_report'), {
      applyInputs: (v) => {
        if (v['input'] != null) this.input = v['input'];
        if (v['project_name'] != null) this.projectName = v['project_name'];
        if (v['period'] != null) this.period = v['period'];
        if (v['team'] != null) this.team = v['team'];
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

      'status_report',

      {

        input: this.input.trim(),

        project_name: this.projectName.trim() || 'N/A',

        period: this.period.trim() || 'This week',

        team: this.team.trim() || 'N/A',

      },

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

    this.projectName = '';

    this.period = '';

    this.team = '';

    this.outputText.set('');

    this.errorMessage.set('');

    this.cacheHit.set(false);

    this.showValidation = false;

  }

}



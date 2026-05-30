import { Component, inject, OnInit, signal } from '@angular/core';

import { FormsModule } from '@angular/forms';

import { GenerateService } from '../../../core/services/generate.service';

import { HistoryRestoreService } from '../../../core/services/history-restore.service';

import { HistoryService } from '../../../core/services/history.service';

import { startToolGeneration } from '../../../core/utils/tool-generation';

import { GenerationActionsComponent } from '../../../shared/components/generation-actions/generation-actions.component';

import { StreamingOutputComponent } from '../../../shared/components/streaming-output/streaming-output.component';



@Component({

  selector: 'app-bug-report',

  standalone: true,

  imports: [FormsModule, GenerationActionsComponent, StreamingOutputComponent],

  template: `

    <div class="page-wrap">

      <h2 class="page-title">Bug Report</h2>

      <p class="page-desc">Convert an informal bug description into a structured report</p>



      <div class="mb-4">

        <label class="field-label">Describe the bug informally</label>

        <textarea [(ngModel)]="input" (ngModelChange)="onInputChange()" rows="8"

          placeholder="e.g. When I click save on the form after adding an attachment, the page crashes. Happens only in Chrome. Works fine in Edge."

          class="field-input">

        </textarea>

        @if (showValidation && !input.trim()) {

          <p class="field-error">Please describe the bug before generating a report.</p>

        }

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

        taskType="bug_report"

        [model]="lastModel()"

        (regenerate)="onGenerate()"

        (retry)="onGenerate()"

        (cancelQueue)="onCancelQueue()"

      />

    </div>

  `,

})

export default class BugReportComponent implements OnInit {

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

    const entry = this.restore.consume('bug_report');

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

      'bug_report',

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



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

  selector: 'app-commit-message',

  standalone: true,

  imports: [FormsModule, GenerationActionsComponent, StreamingOutputComponent],

  template: `

    <div class="page-wrap">

      <h2 class="page-title">Commit Message</h2>

      <p class="page-desc">Write a conventional commit message from a diff or description</p>



      <div class="mb-4">

        <label class="field-label">Describe what changed, or paste a diff</label>

        <textarea [(ngModel)]="input" (ngModelChange)="onInputChange()" rows="9"

          placeholder="e.g. Added email validation to the user registration form. Also fixed the bug where duplicate emails were not rejected."

          class="field-input">

        </textarea>

        @if (showValidation && !input.trim()) {

          <p class="field-error">Please describe the changes before generating a message.</p>

        }

      </div>



      <div class="flex gap-2 mb-5">

        <app-generation-actions
          label="Generate Message"
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

        taskType="commit_message"

        [model]="lastModel()"

        (regenerate)="onGenerate()"

        (retry)="onGenerate()"

        (cancelQueue)="onCancelQueue()"

      />

    </div>

  `,

})

export default class CommitMessageComponent implements OnInit {

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

    restoreFromHistory(this.restore.consume('commit_message'), {
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

      'commit_message',

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



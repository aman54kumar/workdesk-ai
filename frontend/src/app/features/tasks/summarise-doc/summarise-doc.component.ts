import { Component, inject, OnInit, signal } from '@angular/core';

import { FormsModule } from '@angular/forms';

import { GenerateService } from '../../../core/services/generate.service';

import { HistoryRestoreService } from '../../../core/services/history-restore.service';

import { HistoryService } from '../../../core/services/history.service';

import { startToolGeneration } from '../../../core/utils/tool-generation';

import { GenerationActionsComponent } from '../../../shared/components/generation-actions/generation-actions.component';

import { StreamingOutputComponent } from '../../../shared/components/streaming-output/streaming-output.component';



@Component({

  selector: 'app-summarise-doc',

  standalone: true,

  imports: [FormsModule, GenerationActionsComponent, StreamingOutputComponent],

  template: `

    <div class="page-wrap">

      <h2 class="page-title">Summarise Document</h2>

      <p class="page-desc">Summarise any text into clear bullet points</p>



      <div class="grid grid-cols-1 lg:grid-cols-5 gap-5 mb-4">

        <div class="lg:col-span-3 flex flex-col gap-1">

          <label class="field-label">Paste the text to summarise</label>

          <textarea [(ngModel)]="input" (ngModelChange)="onInputChange()" rows="9"

            placeholder="Paste any document, email, or article..."

            class="field-input">

          </textarea>

          @if (showValidation && !input.trim()) {

            <p class="field-error">Please enter some text before summarising.</p>

          }

        </div>



        <div class="lg:col-span-2">

          <label class="field-label mb-2">Output length</label>

          <div class="flex gap-2">

            @for (opt of bulletOptions; track opt) {

              <button type="button" (click)="bulletCount = opt"

                [class.option-pill-active]="bulletCount === opt"

                [class.option-pill]="bulletCount !== opt"

                class="flex-1">

                {{ opt }} bullets

              </button>

            }

          </div>

        </div>

      </div>



      <div class="flex gap-2 mb-5">

        <app-generation-actions
          label="Summarise"
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

        taskType="summarise_doc"

        [model]="lastModel()"

        (regenerate)="onGenerate()"

        (retry)="onGenerate()"

        (cancelQueue)="onCancelQueue()"

      />

    </div>

  `,

})

export default class SummariseDocComponent implements OnInit {

  private gs = inject(GenerateService);

  private history = inject(HistoryService);

  private restore = inject(HistoryRestoreService);



  input = '';

  bulletOptions = ['5', '8', '10'];

  bulletCount = '8';

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

    const entry = this.restore.consume('summarise_doc');

    if (entry) this.outputText.set(entry.output);

  }



  onInputChange(): void {
    this.showValidation = false;
  }

  onGenerate(): void {

    this.showValidation = true;

    if (!this.input.trim()) return;

    const inputWithCount = `${this.input.trim()}\n\nProvide exactly ${this.bulletCount} bullet points.`;


    this.cancelGen = startToolGeneration(

      this.gs,

      this.history,

      'summarise_doc',

      { input: inputWithCount },

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

    this.bulletCount = '8';

    this.outputText.set('');

    this.errorMessage.set('');

    this.cacheHit.set(false);

    this.showValidation = false;

  }

}



import { Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  CloudProvider,
  LlmSettingsService,
  sortCloudProviders,
  UserLlmSettings,
} from '../../../core/services/llm-settings.service';

const OTHER_MODEL = '__other__';

@Component({
  selector: 'app-ai-settings-modal',
  standalone: true,
  imports: [FormsModule],
  template: `
    @if (llm.openSettings()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" (click)="onBackdrop($event)">
        <div class="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-stroke bg-surface p-5 shadow-xl"
          role="dialog" aria-labelledby="aiSettingsTitle">
          <div class="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 id="aiSettingsTitle" class="text-lg font-semibold">AI model settings</h2>
              <p class="text-xs text-muted">Preferences are stored on this device only.</p>
            </div>
            <button type="button" class="btn-ghost text-sm" (click)="llm.closeAiSettings()">Close</button>
          </div>

          <div class="mb-4 flex flex-col gap-2">
            <label class="flex items-center gap-2 text-sm">
              <input type="radio" name="llmSource" value="local" [(ngModel)]="form.source" />
              Local (organization)
            </label>
            <label class="flex items-center gap-2 text-sm" [class.opacity-50]="!cloudEnabled()">
              <input type="radio" name="llmSource" value="cloud" [(ngModel)]="form.source"
                [disabled]="!cloudEnabled()" />
              Cloud (my API key)
            </label>
          </div>

          @if (form.source === 'local') {
            <div class="mb-4">
              <label class="field-label" for="localModel">Local model</label>
              <select id="localModel" class="field-input w-full" [(ngModel)]="form.localModel">
                <option value="">Organization default (per tool)</option>
                @for (m of localModels(); track m) {
                  <option [value]="m">{{ m }}</option>
                }
              </select>
            </div>
          }

          @if (form.source === 'cloud') {
            <div class="mb-3 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
              Your text will be sent to the selected cloud provider using your API key.
            </div>
            <div class="mb-4 flex flex-col gap-3">
              <div>
                <label class="field-label" for="cloudProvider">Provider</label>
                <select id="cloudProvider" class="field-input w-full" [(ngModel)]="form.cloudProvider"
                  (ngModelChange)="onProviderChange()">
                  @for (p of cloudProviders(); track p) {
                    <option [value]="p">{{ llm.providerLabel(p) }}</option>
                  }
                </select>
              </div>

              @if (form.cloudProvider !== 'custom') {
                <div>
                  <label class="field-label" for="cloudModelSelect">Model</label>
                  <select id="cloudModelSelect" class="field-input w-full" [(ngModel)]="cloudModelSelect"
                    (ngModelChange)="onModelSelectChange()">
                    @for (m of cloudPresets(); track m.id) {
                      <option [value]="m.id">{{ m.label }}</option>
                    }
                    <option [value]="otherModelValue">Other (enter model ID manually)</option>
                  </select>
                </div>
              }

              @if (form.cloudProvider === 'custom' || cloudModelSelect === otherModelValue) {
                <div>
                  <label class="field-label" for="cloudModel">Model ID</label>
                  <input id="cloudModel" class="field-input w-full" [(ngModel)]="form.cloudModel"
                    placeholder="e.g. gpt-4o-mini, claude-haiku-4-5-20251001" />
                </div>
              }

              <div>
                <label class="field-label" for="cloudApiKey">API key</label>
                <input id="cloudApiKey" type="password" class="field-input w-full" [(ngModel)]="form.cloudApiKey" />
              </div>
              @if (form.cloudProvider === 'custom') {
                <div>
                  <label class="field-label" for="cloudBaseUrl">Base URL</label>
                  <input id="cloudBaseUrl" class="field-input w-full" [(ngModel)]="form.cloudBaseUrl"
                    placeholder="https://api.example.com/v1" />
                </div>
              }
            </div>
          }

          @if (validationError()) {
            <p class="mb-3 text-sm text-danger">{{ validationError() }}</p>
          }

          <div class="flex justify-end gap-2">
            <button type="button" class="btn-secondary" (click)="llm.closeAiSettings()">Cancel</button>
            <button type="button" class="btn-primary" (click)="save()">Save</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class AiSettingsModalComponent {
  llm = inject(LlmSettingsService);
  form: UserLlmSettings = { ...this.llm.userSettings() };
  cloudModelSelect = '';
  readonly otherModelValue = OTHER_MODEL;
  validationError = signal('');

  cloudEnabled = () => this.llm.options()?.cloud.enabled ?? false;
  localModels = () => this.llm.options()?.local.models ?? [];
  cloudProviders = () =>
    sortCloudProviders(
      (this.llm.options()?.cloud.providers ?? ['openai']) as CloudProvider[],
    );

  cloudPresets = () => {
    const provider = this.form.cloudProvider;
    if (provider === 'custom') return [];
    return this.llm.options()?.cloud.presets?.[provider] ?? [];
  };

  constructor() {
    effect(() => {
      if (this.llm.openSettings()) {
        this.resetForm();
      }
    });
  }

  resetForm(): void {
    this.form = { ...this.llm.userSettings() };
    this.syncModelSelectFromForm();
    this.validationError.set('');
  }

  onProviderChange(): void {
    const presets = this.cloudPresets();
    if (presets.length) {
      this.cloudModelSelect = presets[0].id;
      this.form.cloudModel = presets[0].id;
    } else {
      this.cloudModelSelect = OTHER_MODEL;
      this.form.cloudModel = '';
    }
  }

  onModelSelectChange(): void {
    if (this.cloudModelSelect === OTHER_MODEL) {
      if (!this.form.cloudModel.trim()) {
        this.form.cloudModel = '';
      }
      return;
    }
    this.form.cloudModel = this.cloudModelSelect;
  }

  private syncModelSelectFromForm(): void {
    if (this.form.cloudProvider === 'custom') {
      this.cloudModelSelect = OTHER_MODEL;
      return;
    }
    const presets = this.cloudPresets();
    const match = presets.find((p) => p.id === this.form.cloudModel.trim());
    if (match) {
      this.cloudModelSelect = match.id;
    } else if (this.form.cloudModel.trim()) {
      this.cloudModelSelect = OTHER_MODEL;
    } else if (presets.length) {
      this.cloudModelSelect = presets[0].id;
      this.form.cloudModel = presets[0].id;
    } else {
      this.cloudModelSelect = OTHER_MODEL;
    }
  }

  onBackdrop(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('fixed')) {
      this.llm.closeAiSettings();
    }
  }

  save(): void {
    this.validationError.set('');
    if (this.form.source === 'cloud') {
      if (this.form.cloudProvider !== 'custom' && this.cloudModelSelect !== OTHER_MODEL) {
        this.form.cloudModel = this.cloudModelSelect;
      }
      if (!this.form.cloudModel.trim() || !this.form.cloudApiKey.trim()) {
        this.validationError.set('Cloud mode requires a model and API key.');
        return;
      }
      if (this.form.cloudProvider === 'custom' && !this.form.cloudBaseUrl.trim()) {
        this.validationError.set('Custom provider requires a base URL.');
        return;
      }
    }
    this.llm.saveSettings({ ...this.form });
  }
}

import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgClass } from '@angular/common';
import { AdminService, OrgLlmSettings } from '../../core/services/admin.service';
import { LlmSettingsService } from '../../core/services/llm-settings.service';

const CLOUD_PROVIDER_OPTIONS = [
  { id: 'openai', label: 'OpenAI' },
  { id: 'anthropic', label: 'Anthropic (Claude)' },
  { id: 'google', label: 'Google (Gemini)' },
  { id: 'custom', label: 'Custom (OpenAI-compatible)' },
];

@Component({
  selector: 'app-admin-llm-settings',
  standalone: true,
  imports: [FormsModule, NgClass],
  template: `
    @if (loadError()) {
      <p class="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{{ loadError() }}</p>
    } @else if (loading()) {
      <p class="text-sm text-muted">Loading…</p>
    } @else {
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stroke bg-surface px-4 py-3">
        <p class="text-sm text-muted">{{ dirty() ? 'You have unsaved changes.' : 'All changes saved.' }}</p>
        <div class="flex flex-wrap items-center gap-2">
          @if (saveMessage()) { <span class="text-sm text-muted">{{ saveMessage() }}</span> }
          <button type="button" class="btn-secondary text-sm" [disabled]="testing()" (click)="testConnection()">
            {{ testing() ? 'Testing…' : 'Test connection' }}
          </button>
          <button type="button" class="btn-secondary text-sm" [disabled]="refreshing()" (click)="refreshModels()">
            {{ refreshing() ? 'Refreshing…' : 'Refresh models' }}
          </button>
          <button type="button" class="btn-secondary text-sm" [disabled]="!dirty() || saving()" (click)="reload()">Discard</button>
          <button type="button" class="btn-primary text-sm" [disabled]="!dirty() || saving()" (click)="save()">
            {{ saving() ? 'Saving…' : 'Save changes' }}
          </button>
        </div>
      </div>

      @if (testResult()) {
        <p class="mb-4 rounded-xl border px-4 py-3 text-sm"
          [ngClass]="testResult()!.ok
            ? 'border-success/30 bg-success/10'
            : 'border-danger/30 bg-danger/10'">
          @if (testResult()!.ok) {
            Connection OK — {{ testResult()!.model_count }} model(s) found.
          } @else {
            Connection failed: {{ testResult()!.error }}
          }
        </p>
      }

      <div class="grid gap-5 lg:grid-cols-2">
        <section class="rounded-2xl border border-stroke bg-surface p-5">
          <h2 class="mb-4 text-lg font-semibold">Organization local LLM</h2>
          <div class="flex flex-col gap-4">
            <div>
              <label class="field-label" for="localBackend">Backend type</label>
              <select id="localBackend" class="field-input w-full" [(ngModel)]="draft.local_backend">
                <option value="ollama">Ollama</option>
                <option value="openai_compatible">OpenAI-compatible (LM Studio, vLLM, etc.)</option>
              </select>
            </div>
            <div>
              <label class="field-label" for="localBaseUrl">Base URL</label>
              <input id="localBaseUrl" class="field-input w-full" [(ngModel)]="draft.local_base_url"
                placeholder="http://localhost:11434" />
            </div>
            <div>
              <label class="field-label" for="localApiKey">Local API key (optional)</label>
              <input id="localApiKey" type="password" class="field-input w-full" [(ngModel)]="localApiKeyInput"
                [placeholder]="draft.local_api_key_set ? 'Leave blank to keep existing key' : 'Optional'" />
              @if (draft.local_api_key_set) {
                <label class="mt-2 flex items-center gap-2 text-xs text-muted">
                  <input type="checkbox" [(ngModel)]="clearLocalApiKey" /> Clear stored local API key
                </label>
              }
            </div>
            <div class="grid gap-3 sm:grid-cols-3">
              <div>
                <label class="field-label" for="modelDefault">Default tier</label>
                <input id="modelDefault" class="field-input w-full" [(ngModel)]="draft.model_default" />
              </div>
              <div>
                <label class="field-label" for="modelCode">Code tier</label>
                <input id="modelCode" class="field-input w-full" [(ngModel)]="draft.model_code" />
              </div>
              <div>
                <label class="field-label" for="modelQuality">Quality tier</label>
                <input id="modelQuality" class="field-input w-full" [(ngModel)]="draft.model_quality" />
              </div>
            </div>
            <div>
              <label class="field-label" for="allowedModels">Allowed models (one per line)</label>
              <textarea id="allowedModels" rows="6" class="field-input w-full font-mono text-xs"
                [(ngModel)]="allowedModelsText"></textarea>
              <p class="mt-1 text-xs text-faint">Users and admin tool overrides must pick from this list.</p>
            </div>
          </div>
        </section>

        <section class="flex flex-col gap-5">
          <div class="rounded-2xl border border-stroke bg-surface p-5">
            <h2 class="mb-4 text-lg font-semibold">Cloud policy</h2>
            <label class="mb-4 flex items-center gap-2 text-sm">
              <input type="checkbox" [(ngModel)]="draft.allow_user_cloud" />
              Allow users to use their own cloud API keys (BYOK)
            </label>
            <p class="mb-3 text-xs text-muted">When enabled, users can send prompts to external providers using keys stored in their browser.</p>
            <div class="flex flex-col gap-2">
              @for (p of cloudProviders; track p.id) {
                <label class="flex items-center gap-2 text-sm">
                  <input type="checkbox"
                    [checked]="draft.allowed_cloud_providers.includes(p.id)"
                    (change)="toggleProvider(p.id, $any($event.target).checked)" />
                  {{ p.label }}
                </label>
              }
            </div>
          </div>

          <div class="rounded-2xl border border-stroke bg-surface p-5">
            <h2 class="mb-2 text-lg font-semibold">Cloud model lists</h2>
            <p class="mb-4 text-xs text-muted">
              Optional admin API keys fetch the latest models from each provider.
              Lists auto-refresh about every 30 days; users pick from curated dropdowns in AI settings.
            </p>
            @if (draft.cloud_presets_refreshed_at) {
              <p class="mb-3 text-xs text-faint">Last refreshed: {{ draft.cloud_presets_refreshed_at }}</p>
            }
            <div class="mb-4 flex flex-col gap-3">
              <div>
                <label class="field-label" for="refreshOpenaiKey">OpenAI refresh key (optional)</label>
                <input id="refreshOpenaiKey" type="password" class="field-input w-full" [(ngModel)]="cloudRefreshOpenaiKeyInput"
                  [placeholder]="draft.cloud_refresh_openai_key_set ? 'Leave blank to keep existing key' : 'Optional — or set CLOUD_MODEL_REFRESH_OPENAI_KEY in .env'" />
                @if (draft.cloud_refresh_openai_key_set) {
                  <label class="mt-2 flex items-center gap-2 text-xs text-muted">
                    <input type="checkbox" [(ngModel)]="clearCloudRefreshOpenaiKey" /> Clear stored key
                  </label>
                }
              </div>
              <div>
                <label class="field-label" for="refreshAnthropicKey">Anthropic refresh key (optional)</label>
                <input id="refreshAnthropicKey" type="password" class="field-input w-full" [(ngModel)]="cloudRefreshAnthropicKeyInput"
                  [placeholder]="draft.cloud_refresh_anthropic_key_set ? 'Leave blank to keep existing key' : 'Optional — or set CLOUD_MODEL_REFRESH_ANTHROPIC_KEY in .env'" />
                @if (draft.cloud_refresh_anthropic_key_set) {
                  <label class="mt-2 flex items-center gap-2 text-xs text-muted">
                    <input type="checkbox" [(ngModel)]="clearCloudRefreshAnthropicKey" /> Clear stored key
                  </label>
                }
              </div>
              <div>
                <label class="field-label" for="refreshGoogleKey">Google refresh key (optional)</label>
                <input id="refreshGoogleKey" type="password" class="field-input w-full" [(ngModel)]="cloudRefreshGoogleKeyInput"
                  [placeholder]="draft.cloud_refresh_google_key_set ? 'Leave blank to keep existing key' : 'Optional — or set CLOUD_MODEL_REFRESH_GOOGLE_KEY in .env'" />
                @if (draft.cloud_refresh_google_key_set) {
                  <label class="mt-2 flex items-center gap-2 text-xs text-muted">
                    <input type="checkbox" [(ngModel)]="clearCloudRefreshGoogleKey" /> Clear stored key
                  </label>
                }
              </div>
            </div>
            <button type="button" class="btn-secondary text-sm" [disabled]="refreshingCloudPresets()" (click)="refreshCloudPresets()">
              {{ refreshingCloudPresets() ? 'Refreshing…' : 'Refresh cloud model lists now' }}
            </button>
            @if (cloudPresetsResult()) {
              <p class="mt-3 rounded-xl border px-3 py-2 text-xs"
                [ngClass]="cloudPresetsResult()!.ok
                  ? 'border-success/30 bg-success/10 text-success'
                  : 'border-danger/30 bg-danger/10 text-danger'">
                {{ cloudPresetsMessage() }}
              </p>
            }
          </div>

          <div class="rounded-2xl border border-stroke bg-surface p-5">
            <h2 class="mb-4 text-lg font-semibold">White-label</h2>
            <label class="field-label" for="orgName">Organization display name</label>
            <input id="orgName" class="field-input w-full" [(ngModel)]="draft.org_display_name"
              placeholder="Your Company Pvt. Ltd." />
            <p class="mt-1 text-xs text-faint">Shown in the app sidebar footer.</p>
          </div>
        </section>
      </div>
    }
  `,
})
export default class AdminLlmSettingsComponent implements OnInit {
  private admin = inject(AdminService);
  private llmSettings = inject(LlmSettingsService);

  cloudProviders = CLOUD_PROVIDER_OPTIONS;
  draft!: OrgLlmSettings;
  private savedJson = '';
  allowedModelsText = '';
  localApiKeyInput = '';
  clearLocalApiKey = false;
  cloudRefreshOpenaiKeyInput = '';
  cloudRefreshAnthropicKeyInput = '';
  cloudRefreshGoogleKeyInput = '';
  clearCloudRefreshOpenaiKey = false;
  clearCloudRefreshAnthropicKey = false;
  clearCloudRefreshGoogleKey = false;

  loading = signal(true);
  loadError = signal('');
  saving = signal(false);
  saveMessage = signal('');
  testing = signal(false);
  refreshing = signal(false);
  refreshingCloudPresets = signal(false);
  testResult = signal<{ ok: boolean; model_count?: number; error?: string } | null>(null);
  cloudPresetsResult = signal<{
    ok: boolean;
    skipped?: boolean;
    reason?: string;
    refreshed_providers?: string[];
    errors?: Record<string, string>;
    refreshed_at?: string;
  } | null>(null);

  dirty = () => this.snapshot() !== this.savedJson;

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.loadError.set('');
    this.admin.getLlmSettings().subscribe({
      next: (res) => {
        this.draft = { ...res };
        this.allowedModelsText = res.allowed_models.join('\n');
        this.localApiKeyInput = '';
        this.clearLocalApiKey = false;
        this.cloudRefreshOpenaiKeyInput = '';
        this.cloudRefreshAnthropicKeyInput = '';
        this.cloudRefreshGoogleKeyInput = '';
        this.clearCloudRefreshOpenaiKey = false;
        this.clearCloudRefreshAnthropicKey = false;
        this.clearCloudRefreshGoogleKey = false;
        this.savedJson = this.snapshot();
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set('Could not load LLM settings.');
        this.loading.set(false);
      },
    });
  }

  toggleProvider(id: string, checked: boolean): void {
    const set = new Set(this.draft.allowed_cloud_providers);
    if (checked) set.add(id);
    else set.delete(id);
    this.draft.allowed_cloud_providers = [...set];
  }

  save(): void {
    this.saving.set(true);
    this.saveMessage.set('');
    const body: Record<string, unknown> = {
      local_backend: this.draft.local_backend,
      local_base_url: this.draft.local_base_url,
      model_default: this.draft.model_default,
      model_code: this.draft.model_code,
      model_quality: this.draft.model_quality,
      allowed_models: this.parseAllowedModels(),
      allow_user_cloud: this.draft.allow_user_cloud,
      allowed_cloud_providers: this.draft.allowed_cloud_providers,
      org_display_name: this.draft.org_display_name,
    };
    if (this.localApiKeyInput.trim()) {
      body['local_api_key'] = this.localApiKeyInput.trim();
    }
    if (this.clearLocalApiKey) {
      body['clear_local_api_key'] = true;
    }
    if (this.cloudRefreshOpenaiKeyInput.trim()) {
      body['cloud_refresh_openai_key'] = this.cloudRefreshOpenaiKeyInput.trim();
    }
    if (this.clearCloudRefreshOpenaiKey) {
      body['clear_cloud_refresh_openai_key'] = true;
    }
    if (this.cloudRefreshAnthropicKeyInput.trim()) {
      body['cloud_refresh_anthropic_key'] = this.cloudRefreshAnthropicKeyInput.trim();
    }
    if (this.clearCloudRefreshAnthropicKey) {
      body['clear_cloud_refresh_anthropic_key'] = true;
    }
    if (this.cloudRefreshGoogleKeyInput.trim()) {
      body['cloud_refresh_google_key'] = this.cloudRefreshGoogleKeyInput.trim();
    }
    if (this.clearCloudRefreshGoogleKey) {
      body['clear_cloud_refresh_google_key'] = true;
    }
    this.admin.saveLlmSettings(body).subscribe({
      next: (res) => {
        this.draft = { ...res };
        this.allowedModelsText = res.allowed_models.join('\n');
        this.localApiKeyInput = '';
        this.clearLocalApiKey = false;
        this.cloudRefreshOpenaiKeyInput = '';
        this.cloudRefreshAnthropicKeyInput = '';
        this.cloudRefreshGoogleKeyInput = '';
        this.clearCloudRefreshOpenaiKey = false;
        this.clearCloudRefreshAnthropicKey = false;
        this.clearCloudRefreshGoogleKey = false;
        this.savedJson = this.snapshot();
        this.saving.set(false);
        this.saveMessage.set('Saved.');
      },
      error: () => {
        this.saving.set(false);
        this.saveMessage.set('Save failed.');
      },
    });
  }

  testConnection(): void {
    this.testing.set(true);
    this.testResult.set(null);
    this.admin.testLlmConnection().subscribe({
      next: (res) => {
        this.testResult.set(res);
        this.testing.set(false);
      },
      error: () => {
        this.testResult.set({ ok: false, error: 'Request failed' });
        this.testing.set(false);
      },
    });
  }

  refreshCloudPresets(): void {
    this.refreshingCloudPresets.set(true);
    this.cloudPresetsResult.set(null);
    this.admin.refreshCloudPresets().subscribe({
      next: (res) => {
        this.cloudPresetsResult.set(res);
        this.refreshingCloudPresets.set(false);
        if (res.refreshed_at) {
          this.draft = { ...this.draft, cloud_presets_refreshed_at: res.refreshed_at };
        }
        this.llmSettings.fetchOptions();
      },
      error: () => {
        this.cloudPresetsResult.set({ ok: false, reason: 'Request failed' });
        this.refreshingCloudPresets.set(false);
      },
    });
  }

  cloudPresetsMessage(): string {
    const r = this.cloudPresetsResult();
    if (!r) return '';
    if (!r.ok) {
      const errText = r.errors ? Object.entries(r.errors).map(([k, v]) => `${k}: ${v}`).join('; ') : '';
      return errText || r.reason || 'Refresh failed.';
    }
    if (r.skipped) {
      return r.reason === 'not stale'
        ? 'Lists are still fresh — no refresh needed yet.'
        : 'No refresh keys configured — using built-in model lists.';
    }
    const providers = r.refreshed_providers?.join(', ') || 'none';
    return `Refreshed: ${providers}.`;
  }

  refreshModels(): void {
    this.refreshing.set(true);
    this.admin.refreshLlmModels().subscribe({
      next: (res) => {
        const merged = new Set([...this.parseAllowedModels(), ...res.models]);
        this.allowedModelsText = [...merged].sort().join('\n');
        this.refreshing.set(false);
      },
      error: () => {
        this.refreshing.set(false);
        this.saveMessage.set('Could not refresh models from server.');
      },
    });
  }

  private parseAllowedModels(): string[] {
    return this.allowedModelsText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
  }

  private snapshot(): string {
    return JSON.stringify({
      ...this.draft,
      allowed_models: this.parseAllowedModels(),
      local_api_key_input: this.localApiKeyInput,
      clear_local_api_key: this.clearLocalApiKey,
      cloud_refresh_openai_key_input: this.cloudRefreshOpenaiKeyInput,
      clear_cloud_refresh_openai_key: this.clearCloudRefreshOpenaiKey,
      cloud_refresh_anthropic_key_input: this.cloudRefreshAnthropicKeyInput,
      clear_cloud_refresh_anthropic_key: this.clearCloudRefreshAnthropicKey,
      cloud_refresh_google_key_input: this.cloudRefreshGoogleKeyInput,
      clear_cloud_refresh_google_key: this.clearCloudRefreshGoogleKey,
    });
  }
}

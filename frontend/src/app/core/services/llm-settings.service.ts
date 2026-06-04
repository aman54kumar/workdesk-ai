import { Injectable, computed, inject, signal } from '@angular/core';
import { environment } from '../../../environments/environment';

export type LlmSource = 'local' | 'cloud';
export type CloudProvider = 'openai' | 'anthropic' | 'google' | 'custom';

export const CLOUD_PROVIDER_ORDER: CloudProvider[] = [
  'openai',
  'anthropic',
  'google',
  'custom',
];

export function sortCloudProviders(providers: CloudProvider[]): CloudProvider[] {
  const rank = (provider: CloudProvider) => {
    const index = CLOUD_PROVIDER_ORDER.indexOf(provider);
    return index === -1 ? CLOUD_PROVIDER_ORDER.length : index;
  };
  return [...providers].sort((a, b) => rank(a) - rank(b));
}

export interface CloudModelPreset {
  id: string;
  label: string;
}

export interface LlmOptions {
  local: { enabled: boolean; models: string[]; backend: string };
  cloud: {
    enabled: boolean;
    providers: string[];
    presets: Record<string, CloudModelPreset[]>;
  };
  org_display_name: string;
}

export interface UserLlmSettings {
  source: LlmSource;
  localModel: string;
  cloudProvider: CloudProvider;
  cloudModel: string;
  cloudApiKey: string;
  cloudBaseUrl: string;
}

export interface LlmPayload {
  source: LlmSource;
  model?: string;
  provider?: CloudProvider;
  api_key?: string;
  base_url?: string;
}

const STORAGE_KEY = 'workdesk_llm_v1';

const DEFAULT_SETTINGS: UserLlmSettings = {
  source: 'local',
  localModel: '',
  cloudProvider: 'openai',
  cloudModel: '',
  cloudApiKey: '',
  cloudBaseUrl: '',
};

@Injectable({ providedIn: 'root' })
export class LlmSettingsService {
  private settings = signal<UserLlmSettings>(this.load());
  options = signal<LlmOptions | null>(null);

  readonly userSettings = this.settings.asReadonly();
  readonly isCloud = computed(() => this.settings().source === 'cloud');
  readonly orgDisplayName = computed(() => this.options()?.org_display_name ?? '');

  readonly effectiveLabel = computed(() => {
    const s = this.settings();
    if (s.source === 'cloud') {
      const name = this.providerLabel(s.cloudProvider);
      const presets = this.options()?.cloud.presets?.[s.cloudProvider] ?? [];
      const match = presets.find((p) => p.id === s.cloudModel.trim());
      const model = (match?.label ?? s.cloudModel.trim()) || 'model not set';
      return `${name} · ${model}`;
    }
    const model = s.localModel.trim();
    return model ? `Local · ${model}` : 'Local · organization default';
  });

  constructor() {
    this.fetchOptions();
  }

  fetchOptions(): void {
    fetch(`${environment.apiUrl}/generate/llm-options`)
      .then((r) => r.json())
      .then((data: LlmOptions) => {
        if (!data.cloud.presets) {
          data.cloud.presets = {};
        }
        data.cloud.providers = sortCloudProviders(
          data.cloud.providers as CloudProvider[],
        );
        this.options.set(data);
        this.ensureValidLocalModel(data);
      })
      .catch(() => undefined);
  }

  openSettings = signal(false);

  openAiSettings(): void {
    this.openSettings.set(true);
  }

  closeAiSettings(): void {
    this.openSettings.set(false);
  }

  update(patch: Partial<UserLlmSettings>): void {
    const next = { ...this.settings(), ...patch };
    this.settings.set(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  saveSettings(form: UserLlmSettings): void {
    this.settings.set(form);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
    this.closeAiSettings();
  }

  buildGeneratePayload(): LlmPayload | undefined {
    const s = this.settings();
    const opts = this.options();

    if (s.source === 'cloud') {
      if (!opts?.cloud.enabled) return undefined;
      if (!s.cloudApiKey.trim() || !s.cloudModel.trim()) return undefined;
      const payload: LlmPayload = {
        source: 'cloud',
        model: s.cloudModel.trim(),
        provider: s.cloudProvider,
        api_key: s.cloudApiKey.trim(),
      };
      if (s.cloudProvider === 'custom' && s.cloudBaseUrl.trim()) {
        payload.base_url = s.cloudBaseUrl.trim();
      }
      return payload;
    }

    if (s.localModel.trim()) {
      return { source: 'local', model: s.localModel.trim() };
    }
    return undefined;
  }

  providerLabel(provider: CloudProvider): string {
    return {
      openai: 'OpenAI',
      anthropic: 'Anthropic',
      google: 'Google',
      custom: 'Custom',
    }[provider];
  }

  private load(): UserLlmSettings {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT_SETTINGS };
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  private ensureValidLocalModel(opts: LlmOptions): void {
    const s = this.settings();
    if (s.source !== 'local' || !s.localModel) return;
    if (!opts.local.models.includes(s.localModel)) {
      this.update({ localModel: opts.local.models[0] ?? '' });
    }
  }
}

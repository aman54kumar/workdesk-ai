import { apiUrl } from './api-config';

export type LlmSource = 'local' | 'cloud';
export type CloudProvider = 'openai' | 'anthropic' | 'google' | 'custom';

export const CLOUD_PROVIDER_ORDER: CloudProvider[] = [
  'openai',
  'anthropic',
  'google',
  'custom',
];

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

const STORAGE_KEY = 'workdesk_outlook_llm_v1';

const DEFAULT_SETTINGS: UserLlmSettings = {
  source: 'local',
  localModel: '',
  cloudProvider: 'openai',
  cloudModel: '',
  cloudApiKey: '',
  cloudBaseUrl: '',
};

let cachedOptions: LlmOptions | null = null;

export function sortCloudProviders(providers: CloudProvider[]): CloudProvider[] {
  const rank = (provider: CloudProvider) => {
    const index = CLOUD_PROVIDER_ORDER.indexOf(provider);
    return index === -1 ? CLOUD_PROVIDER_ORDER.length : index;
  };
  return [...providers].sort((a, b) => rank(a) - rank(b));
}

export function loadLlmSettings(): UserLlmSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveLlmSettings(form: UserLlmSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
}

export function providerLabel(provider: CloudProvider): string {
  return {
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    google: 'Google',
    custom: 'Custom',
  }[provider];
}

export function buildGeneratePayload(
  settings: UserLlmSettings,
  options: LlmOptions | null,
): LlmPayload | undefined {
  if (settings.source === 'cloud') {
    if (!options?.cloud.enabled) return undefined;
    if (!settings.cloudApiKey.trim() || !settings.cloudModel.trim()) return undefined;
    const payload: LlmPayload = {
      source: 'cloud',
      model: settings.cloudModel.trim(),
      provider: settings.cloudProvider,
      api_key: settings.cloudApiKey.trim(),
    };
    if (settings.cloudProvider === 'custom' && settings.cloudBaseUrl.trim()) {
      payload.base_url = settings.cloudBaseUrl.trim();
    }
    return payload;
  }
  if (settings.localModel.trim()) {
    return { source: 'local', model: settings.localModel.trim() };
  }
  return undefined;
}

export function effectiveLabel(
  settings: UserLlmSettings,
  options: LlmOptions | null,
): string {
  if (settings.source === 'cloud') {
    const name = providerLabel(settings.cloudProvider);
    const presets = options?.cloud.presets?.[settings.cloudProvider] ?? [];
    const match = presets.find((p) => p.id === settings.cloudModel.trim());
    const model = (match?.label ?? settings.cloudModel.trim()) || 'model not set';
    return `${name} · ${model}`;
  }
  const model = settings.localModel.trim();
  return model ? `Local · ${model}` : 'Local · organization default';
}

export async function fetchLlmOptions(): Promise<LlmOptions | null> {
  try {
    const r = await fetch(apiUrl('/generate/llm-options'));
    if (!r.ok) return null;
    const data = (await r.json()) as LlmOptions;
    if (!data.cloud.presets) data.cloud.presets = {};
    data.cloud.providers = sortCloudProviders(
      data.cloud.providers as CloudProvider[],
    );
    cachedOptions = data;
    return data;
  } catch {
    return null;
  }
}

export function getCachedLlmOptions(): LlmOptions | null {
  return cachedOptions;
}

export function ensureValidLocalModel(
  settings: UserLlmSettings,
  opts: LlmOptions,
): UserLlmSettings {
  if (settings.source !== 'local' || !settings.localModel) return settings;
  if (!opts.local.models.includes(settings.localModel)) {
    return { ...settings, localModel: opts.local.models[0] ?? '' };
  }
  return settings;
}

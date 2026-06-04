import {
  defaultApiBaseUrl,
  getApiBaseUrl,
  getAppBaseUrl,
  isMixedContentApiUrl,
  mixedContentHelpText,
  setApiBaseUrl,
  setAppBaseUrl,
} from '../services/api-config';
import { openWorkdeskApp } from '../services/open-app';
import { testApiConnection } from '../services/generate-client';
import {
  CLOUD_PROVIDER_ORDER,
  type CloudProvider,
  ensureValidLocalModel,
  fetchLlmOptions,
  loadLlmSettings,
  providerLabel,
  saveLlmSettings,
  sortCloudProviders,
  type LlmOptions,
  type UserLlmSettings,
} from '../services/llm-settings';
import { waitForOffice } from '../services/office-mail';
import { iconHtml } from '../ui/icons';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

function show(el: HTMLElement, visible: boolean): void {
  el.classList.toggle('hidden', !visible);
}

let options: LlmOptions | null = null;

function readForm(): UserLlmSettings {
  const source = ($('llmSource') as HTMLSelectElement).value as 'local' | 'cloud';
  const cloudProvider = ($('cloudProvider') as HTMLSelectElement).value as CloudProvider;
  const modelSelect = $('cloudModel') as HTMLSelectElement;
  const customInput = $('cloudModelCustom') as HTMLInputElement;
  let cloudModel = modelSelect.value;
  if (cloudProvider === 'custom' && customInput.value.trim()) {
    cloudModel = customInput.value.trim();
  }
  return {
    source,
    localModel: ($('localModel') as HTMLSelectElement).value,
    cloudProvider,
    cloudModel,
    cloudApiKey: ($('cloudApiKey') as HTMLInputElement).value,
    cloudBaseUrl: ($('cloudBaseUrl') as HTMLInputElement).value,
  };
}

function cloudEnabled(): boolean {
  return !!options?.cloud.enabled;
}

function providerList(): CloudProvider[] {
  const fromServer = sortCloudProviders(
    (options?.cloud.providers ?? []) as CloudProvider[],
  );
  if (fromServer.length > 0) return fromServer;
  if (cloudEnabled()) return [...CLOUD_PROVIDER_ORDER];
  return [];
}

function updateSourceBlocks(source: 'local' | 'cloud'): void {
  const useCloud = source === 'cloud' && cloudEnabled();
  show($('localBlock'), !useCloud);
  show($('cloudBlock'), useCloud);
  if (source === 'cloud' && !cloudEnabled()) {
    ($('llmSource') as HTMLSelectElement).value = 'local';
    show($('localBlock'), true);
    show($('cloudBlock'), false);
  }
}

function setCloudFieldsDisabled(disabled: boolean): void {
  for (const id of ['cloudProvider', 'cloudModel', 'cloudModelCustom', 'cloudApiKey', 'cloudBaseUrl']) {
    const el = $(id) as HTMLInputElement | HTMLSelectElement;
    el.disabled = disabled;
  }
}

function updateCloudHint(fetchError?: string): void {
  const hint = $('cloudHint');
  if (fetchError) {
    hint.textContent = fetchError;
    hint.style.color = 'var(--danger)';
    return;
  }
  hint.style.color = '';
  if (!options) {
    hint.textContent =
      'Could not load server options. Set API URL above, then click Test connection.';
    return;
  }
  if (!cloudEnabled()) {
    hint.textContent =
      'Cloud BYOK is off on the server. Use Local (organization), or ask admin to enable allow_user_cloud in Admin → LLM settings.';
    return;
  }
  hint.textContent = 'API keys are stored only in this browser.';
}

function updateLlmSourceOptions(): void {
  const cloudOpt = $('llmSourceCloud') as HTMLOptionElement;
  if (!options) {
    cloudOpt.disabled = false;
    return;
  }
  cloudOpt.disabled = !cloudEnabled();
  if (!cloudEnabled() && ($('llmSource') as HTMLSelectElement).value === 'cloud') {
    ($('llmSource') as HTMLSelectElement).value = 'local';
    updateSourceBlocks('local');
  }
}

function populateLocalModels(): void {
  const select = $('localModel') as HTMLSelectElement;
  while (select.options.length > 1) select.remove(1);
  const models = options?.local.models ?? [];
  for (const m of models) {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = m;
    select.appendChild(opt);
  }
  const hint = $('localHint');
  if (!options) {
    hint.textContent = 'Click Test connection after setting API URL.';
  } else if (!options.local.enabled) {
    hint.textContent = 'Local LLM is not configured on the server.';
  } else {
    hint.textContent = `Backend: ${options.local.backend}. Leave default to use organization tier model.`;
  }
}

function populateCloudProviders(selected?: CloudProvider): void {
  const select = $('cloudProvider') as HTMLSelectElement;
  select.innerHTML = '';
  const providers = providerList();

  if (providers.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'Not available — use Local or enable cloud on server';
    select.appendChild(opt);
    select.disabled = true;
    setCloudFieldsDisabled(true);
    return;
  }

  select.disabled = false;
  setCloudFieldsDisabled(false);

  for (const p of providers) {
    const opt = document.createElement('option');
    opt.value = p;
    opt.textContent = providerLabel(p);
    select.appendChild(opt);
  }

  const pick =
    selected && providers.includes(selected) ? selected : providers[0];
  select.value = pick;
}

function populateCloudModels(provider: CloudProvider, selectedId: string): void {
  const select = $('cloudModel') as HTMLSelectElement;
  const customInput = $('cloudModelCustom') as HTMLInputElement;
  select.innerHTML = '';
  const presets = options?.cloud.presets?.[provider] ?? [];
  for (const p of presets) {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.label;
    select.appendChild(opt);
  }
  if (presets.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'Type model id below';
    select.appendChild(opt);
  }
  const match = presets.find((p) => p.id === selectedId);
  select.value = match ? selectedId : (presets[0]?.id ?? '');
  customInput.value = match ? '' : selectedId;
  const showCustom = provider === 'custom' || presets.length === 0;
  show(customInput, showCustom);
  customInput.disabled = !showCustom;
  show($('customUrlBlock'), provider === 'custom');
}

function applyFormToUi(settings: UserLlmSettings): void {
  ($('apiUrl') as HTMLInputElement).value = getApiBaseUrl();
  ($('appUrl') as HTMLInputElement).value = getAppBaseUrl();
  const source =
    settings.source === 'cloud' && !cloudEnabled() ? 'local' : settings.source;
  ($('llmSource') as HTMLSelectElement).value = source;
  ($('localModel') as HTMLSelectElement).value = settings.localModel;
  ($('cloudApiKey') as HTMLInputElement).value = settings.cloudApiKey;
  ($('cloudBaseUrl') as HTMLInputElement).value = settings.cloudBaseUrl;
  updateLlmSourceOptions();
  updateSourceBlocks(source);
  populateCloudProviders(settings.cloudProvider);
  if (source === 'cloud' && cloudEnabled()) {
    populateCloudModels(settings.cloudProvider, settings.cloudModel);
  }
}

async function reloadServerOptions(): Promise<string | undefined> {
  setApiBaseUrl(($('apiUrl') as HTMLInputElement).value.trim());
  if (isMixedContentApiUrl()) {
    return mixedContentHelpText();
  }
  try {
    options = await fetchLlmOptions();
  } catch (e) {
    options = null;
    return e instanceof Error ? e.message : 'Failed to fetch';
  }
  updateLlmSourceOptions();
  if (!options) {
    return 'Cannot reach API. Check URL, backend running, and proxy (npm run dev).';
  }
  populateLocalModels();
  const form = readForm();
  if (form.source === 'cloud' && cloudEnabled()) {
    populateCloudProviders(form.cloudProvider);
    populateCloudModels(
      ($('cloudProvider') as HTMLSelectElement).value as CloudProvider,
      form.cloudModel,
    );
  }
  updateSourceBlocks(($('llmSource') as HTMLSelectElement).value as 'local' | 'cloud');
  return undefined;
}

function wireEvents(): void {
  $('llmSource').addEventListener('change', () => {
    updateSourceBlocks(($('llmSource') as HTMLSelectElement).value as 'local' | 'cloud');
    if (($('llmSource') as HTMLSelectElement).value === 'cloud' && cloudEnabled()) {
      populateCloudProviders();
      populateCloudModels(
        ($('cloudProvider') as HTMLSelectElement).value as CloudProvider,
        '',
      );
    }
  });

  $('cloudProvider').addEventListener('change', () => {
    const provider = ($('cloudProvider') as HTMLSelectElement).value as CloudProvider;
    if (!provider) return;
    populateCloudModels(provider, '');
    show($('customUrlBlock'), provider === 'custom');
  });

  $('btnOpenApp').addEventListener('click', () => {
    setAppBaseUrl(($('appUrl') as HTMLInputElement).value.trim());
    openWorkdeskApp();
  });

  $('btnUseProxy').addEventListener('click', () => {
    ($('apiUrl') as HTMLInputElement).value = defaultApiBaseUrl();
  });

  $('btnSave').addEventListener('click', async () => {
    setApiBaseUrl(($('apiUrl') as HTMLInputElement).value.trim());
    setAppBaseUrl(($('appUrl') as HTMLInputElement).value.trim());
    const err = await reloadServerOptions();
    updateCloudHint(err);
    let form = readForm();
    if (options) form = ensureValidLocalModel(form, options);
    saveLlmSettings(form);
    $('saveStatus').textContent = err ? 'Saved, but API not reachable.' : 'Saved.';
    $('saveStatus').style.color = err ? 'var(--danger)' : 'var(--success)';
  });

  $('btnTest').addEventListener('click', async () => {
    const status = $('saveStatus');
    status.textContent = 'Testing…';
    status.style.color = 'var(--muted)';
    const reloadErr = await reloadServerOptions();
    if (reloadErr) {
      status.textContent = reloadErr;
      status.style.color = 'var(--danger)';
      updateCloudHint(reloadErr);
      return;
    }
    try {
      await testApiConnection();
      status.textContent = 'Connected. Options loaded from server.';
      status.style.color = 'var(--success)';
      updateCloudHint();
    } catch (e) {
      status.textContent =
        e instanceof Error ? e.message : 'Connection failed. Check API URL and CORS.';
      status.style.color = 'var(--danger)';
      updateCloudHint(status.textContent);
    }
  });
}

function mountIcons(): void {
  const ids: Array<[string, Parameters<typeof iconHtml>[0]]> = [
    ['iconBack', 'back'],
    ['iconOpenApp', 'external'],
  ];
  for (const [id, name] of ids) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = iconHtml(name);
  }
}

async function init(): Promise<void> {
  await waitForOffice();
  mountIcons();
  let settings = loadLlmSettings();
  if (getApiBaseUrl() === 'http://localhost:8000' && isMixedContentApiUrl('http://localhost:8000')) {
    setApiBaseUrl(defaultApiBaseUrl());
  }
  const err = await reloadServerOptions();
  if (options) settings = ensureValidLocalModel(settings, options);
  applyFormToUi(settings);
  updateCloudHint(err);
  wireEvents();
}

void init();

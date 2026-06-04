import {
  applyStreamFrame,
  loadLimits,
  startStreamGenerate,
} from '../services/generate-client';
import {
  effectiveLabel,
  fetchLlmOptions,
  loadLlmSettings,
} from '../services/llm-settings';
import { cleanGeneratedForInsert } from '../services/body-parts';
import {
  type MessageBodySnapshot,
  getMessageBodySnapshot,
  insertGeneratedBody,
  isComposeAvailable,
  restoreMessageBody,
  waitForOffice,
} from '../services/office-mail';
import {
  addHistoryEntry,
  clearHistory,
  formatHistoryMeta,
  historyPreview,
  listHistory,
  removeHistoryEntry,
  snapshotFromHistoryGenerated,
  snapshotFromHistoryOriginal,
} from '../services/outlook-history';
import { openWorkdeskApp } from '../services/open-app';
import { iconHtml } from '../ui/icons';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const $btn = (id: string) => $(id) as HTMLButtonElement;

let selectedLength = 'Standard';
let currentDraft = '';
let generatedText = '';
let bodySnapshot: MessageBodySnapshot | null = null;
let cancelStream: (() => void) | null = null;

function mountIcons(): void {
  const map: Record<string, Parameters<typeof iconHtml>[0]> = {
    iconSettings: 'settings',
    iconOpenApp: 'external',
    iconTabCompose: 'compose',
    iconTabHistory: 'history',
    iconRefresh: 'refresh',
    iconGenerate: 'sparkles',
    iconStop: 'stop',
    iconInsert: 'mailInsert',
    iconCopy: 'copy',
    iconEmptyHistory: 'history',
  };
  for (const [id, name] of Object.entries(map)) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = iconHtml(name);
  }
}

function show(el: HTMLElement, visible: boolean): void {
  el.classList.toggle('hidden', !visible);
}

function setError(msg: string): void {
  const box = $('errorBox');
  if (msg) {
    box.textContent = msg;
    show(box, true);
  } else {
    show(box, false);
  }
}

function setQueue(position: number, etaS: number): void {
  const el = $('queueStatus');
  if (position > 0) {
    el.textContent = `Queue #${position}${etaS > 0 ? ` · ~${etaS}s` : ''}`;
    show(el, true);
  } else {
    show(el, false);
  }
}

function updateTabInk(tab: 'compose' | 'history'): void {
  const ink = document.querySelector<HTMLElement>('.tab-ink');
  const activeTab = $(tab === 'compose' ? 'tabCompose' : 'tabHistory');
  if (!ink || !activeTab) return;
  ink.style.width = `${activeTab.offsetWidth}px`;
  ink.style.transform = `translateX(${activeTab.offsetLeft}px)`;
}

function switchTab(tab: 'compose' | 'history'): void {
  const isCompose = tab === 'compose';
  $('tabCompose').classList.toggle('is-active', isCompose);
  $('tabHistory').classList.toggle('is-active', !isCompose);
  $('tabCompose').setAttribute('aria-selected', String(isCompose));
  $('tabHistory').setAttribute('aria-selected', String(!isCompose));
  $('panelCompose').classList.toggle('is-active', isCompose);
  $('panelHistory').classList.toggle('is-active', !isCompose);
  $('panelCompose').hidden = !isCompose;
  $('panelHistory').hidden = isCompose;
  updateTabInk(tab);
  if (!isCompose) renderHistory();
}

async function refreshDraft(): Promise<void> {
  const preview = $('draftPreview') as HTMLTextAreaElement;
  const emptyHint = $('draftEmpty');
  if (!isComposeAvailable()) {
    preview.value = '';
    preview.placeholder = 'Open a compose window to use this add-in.';
    show(emptyHint, false);
    return;
  }
  try {
    bodySnapshot = await getMessageBodySnapshot();
    currentDraft = bodySnapshot.editableText;
    preview.value = bodySnapshot.previewText;
    show(emptyHint, !currentDraft.trim());
    setError('');
  } catch (e) {
    currentDraft = '';
    preview.value = '';
    setError(e instanceof Error ? e.message : 'Could not read draft.');
  }
}

async function loadLlmInfo(): Promise<void> {
  const opts = await fetchLlmOptions();
  const settings = loadLlmSettings();
  $('llmBadge').textContent = effectiveLabel(settings, opts);
}

function setupLengthSegments(): void {
  document.querySelectorAll<HTMLButtonElement>('.segmented button[data-length]').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedLength = btn.dataset['length'] ?? 'Standard';
      document.querySelectorAll('.segmented button[data-length]').forEach((b) => {
        b.classList.toggle('is-active', b === btn);
      });
    });
  });
}

async function onGenerate(): Promise<void> {
  await refreshDraft();
  const input = currentDraft.trim() || ($('draftPreview') as HTMLTextAreaElement).value.trim();
  if (!input) {
    setError('Draft is empty. Add text in Outlook, then refresh.');
    return;
  }

  const tone = ($('tone') as HTMLSelectElement).value;
  setError('');
  generatedText = '';
  if (!bodySnapshot) bodySnapshot = await getMessageBodySnapshot();

  const output = $('output') as HTMLTextAreaElement;
  output.value = '';
  $btn('btnInsert').disabled = true;
  $btn('btnCopy').disabled = true;
  show($('statusGenerating'), true);
  $btn('btnGenerate').disabled = true;
  show($('btnStop'), true);

  cancelStream = startStreamGenerate(
    'email_composer',
    { input, tone, length: selectedLength },
    {
      onFrame: (r) => {
        applyStreamFrame(r, {
          appendChunk: (c) => {
            generatedText += c;
            output.value = generatedText;
          },
          setCacheHit: () => undefined,
          setQueued: (q) => {
            if (q) setQueue(q.position, q.eta_s);
            else setQueue(0, 0);
          },
          setError: (msg) => setError(msg),
        });
        if (r.incomplete) {
          setError('Connection ended early. Try again.');
        }
        if (r.truncated) {
          setError('Response was truncated at the model limit.');
        }
      },
      onError: (msg) => setError(msg),
      onComplete: () => {
        show($('statusGenerating'), false);
        $btn('btnGenerate').disabled = false;
        show($('btnStop'), false);
        cancelStream = null;
        if (generatedText.trim()) {
          $btn('btnInsert').disabled = false;
          $btn('btnCopy').disabled = false;
        }
      },
    },
  );
}

function onStop(): void {
  cancelStream?.();
  cancelStream = null;
  show($('btnStop'), false);
  $btn('btnGenerate').disabled = false;
  show($('statusGenerating'), false);
}

async function onInsert(): Promise<void> {
  if (!generatedText.trim() || !bodySnapshot) return;
  show($('insertHint'), false);
  try {
    await insertGeneratedBody(generatedText, bodySnapshot);
    addHistoryEntry(
      bodySnapshot,
      generatedText,
      ($('tone') as HTMLSelectElement).value,
      selectedLength,
    );
    const cleaned = cleanGeneratedForInsert(generatedText);
    currentDraft = cleaned;
    ($('draftPreview') as HTMLTextAreaElement).value = cleaned;
    bodySnapshot = await getMessageBodySnapshot();
    renderHistory();
  } catch {
    show($('insertHint'), true);
    await copyToClipboard(generatedText);
  }
}

async function onCopy(): Promise<void> {
  if (!generatedText.trim()) return;
  await copyToClipboard(generatedText);
}

async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
}

function renderHistory(): void {
  const list = listHistory();
  const ul = $('historyList');
  const empty = $('historyEmpty');
  ul.innerHTML = '';
  show(ul, list.length > 0);
  show(empty, list.length === 0);

  for (const entry of list) {
    const li = document.createElement('li');
    li.className = 'history-item';

    const top = document.createElement('div');
    top.className = 'history-item-top';

    const body = document.createElement('div');
    body.className = 'history-item-body';
    const meta = document.createElement('div');
    meta.className = 'history-meta';
    meta.textContent = formatHistoryMeta(entry);
    const preview = document.createElement('p');
    preview.className = 'history-preview';
    preview.textContent = historyPreview(entry);
    const tags = document.createElement('div');
    tags.className = 'history-tags';
    tags.innerHTML = `<span class="tag">${escapeHtml(entry.tone)}</span><span class="tag">${escapeHtml(entry.length)}</span>`;
    body.append(meta, preview, tags);

    const btnRemove = document.createElement('button');
    btnRemove.type = 'button';
    btnRemove.className = 'icon-btn btn-danger-ghost';
    btnRemove.title = 'Remove';
    btnRemove.setAttribute('aria-label', 'Remove this history item');
    btnRemove.innerHTML = iconHtml('trash');
    btnRemove.addEventListener('click', () => {
      removeHistoryEntry(entry.id);
      renderHistory();
    });

    top.append(body, btnRemove);

    const actions = document.createElement('div');
    actions.className = 'history-actions';

    const btnOriginal = document.createElement('button');
    btnOriginal.type = 'button';
    btnOriginal.className = 'btn btn-secondary';
    btnOriginal.textContent = 'Restore original';
    btnOriginal.addEventListener('click', () => {
      void applySnapshot(snapshotFromHistoryOriginal(entry));
      switchTab('compose');
    });

    const btnGenerated = document.createElement('button');
    btnGenerated.type = 'button';
    btnGenerated.className = 'btn btn-secondary';
    btnGenerated.textContent = 'Use generated';
    btnGenerated.addEventListener('click', () => {
      void applySnapshot(snapshotFromHistoryGenerated(entry));
      switchTab('compose');
    });

    actions.append(btnOriginal, btnGenerated);
    li.append(top, actions);
    ul.appendChild(li);
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function applySnapshot(snapshot: MessageBodySnapshot): Promise<void> {
  show($('insertHint'), false);
  try {
    await restoreMessageBody(snapshot);
    bodySnapshot = snapshot;
    currentDraft = snapshot.editableText;
    ($('draftPreview') as HTMLTextAreaElement).value = snapshot.previewText;
  } catch {
    show($('insertHint'), true);
    await copyToClipboard(snapshot.editableText);
  }
}

function wireEvents(): void {
  $('tabCompose').addEventListener('click', () => switchTab('compose'));
  $('tabHistory').addEventListener('click', () => switchTab('history'));
  $('btnOpenApp').addEventListener('click', () => openWorkdeskApp());
  $('btnRefresh').addEventListener('click', () => void refreshDraft());
  $('btnGenerate').addEventListener('click', () => void onGenerate());
  $('btnStop').addEventListener('click', () => onStop());
  $('btnInsert').addEventListener('click', () => void onInsert());
  $('btnCopy').addEventListener('click', () => void onCopy());
  $('btnClearHistory').addEventListener('click', () => {
    if (listHistory().length > 0 && !confirm('Clear all history items?')) return;
    clearHistory();
    renderHistory();
  });
}

async function init(): Promise<void> {
  mountIcons();
  await waitForOffice();
  setupLengthSegments();
  wireEvents();
  updateTabInk('compose');
  void loadLimits();
  void loadLlmInfo();
  await refreshDraft();
  renderHistory();
}

void init();

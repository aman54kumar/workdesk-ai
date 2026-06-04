import {
  cleanGeneratedForInsert,
  mergeHtmlBodyAndSignature,
  plainTextToHtml,
} from './body-parts';
import type { MessageBodySnapshot } from './office-mail';

export interface OutlookHistoryEntry {
  id: string;
  originalBody: string;
  generatedBody: string;
  tone: string;
  length: string;
  timestamp: number;
  /** Full HTML before insert (keeps signature & formatting). */
  originalFullHtml?: string;
  signatureHtml?: string;
  generatedFullHtml?: string;
}

const STORAGE_KEY = 'workdesk_outlook_email_history';
const MAX_ENTRIES = 20;
const MAX_BODY_BYTES = 50_000;

function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `h-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

function trimBody(text: string): string {
  const encoder = new TextEncoder();
  let s = text;
  while (encoder.encode(s).length > MAX_BODY_BYTES && s.length > 0) {
    s = s.slice(0, -500);
  }
  return s;
}

function readList(): OutlookHistoryEntry[] {
  try {
    return JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? '[]',
    ) as OutlookHistoryEntry[];
  } catch {
    return [];
  }
}

function writeList(list: OutlookHistoryEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_ENTRIES)));
  } catch {
    /* storage blocked */
  }
}

export function listHistory(): OutlookHistoryEntry[] {
  return readList();
}

export function addHistoryEntry(
  snapshot: MessageBodySnapshot,
  generatedPlain: string,
  tone: string,
  length: string,
): OutlookHistoryEntry {
  const cleaned = cleanGeneratedForInsert(generatedPlain);
  const generatedHtml = mergeHtmlBodyAndSignature(
    plainTextToHtml(cleaned, snapshot.bodyHtml || snapshot.fullHtml),
    snapshot.signatureHtml,
  );
  const entry: OutlookHistoryEntry = {
    id: newId(),
    originalBody: trimBody(snapshot.editableText),
    generatedBody: trimBody(cleaned),
    tone,
    length,
    timestamp: Date.now(),
    originalFullHtml: trimBody(snapshot.fullHtml),
    signatureHtml: trimBody(snapshot.signatureHtml),
    generatedFullHtml: trimBody(generatedHtml),
  };
  const list = [entry, ...readList().filter((e) => e.id !== entry.id)].slice(
    0,
    MAX_ENTRIES,
  );
  writeList(list);
  return entry;
}

export function getHistoryEntry(id: string): OutlookHistoryEntry | undefined {
  return readList().find((e) => e.id === id);
}

export function clearHistory(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function removeHistoryEntry(id: string): void {
  writeList(readList().filter((e) => e.id !== id));
}

export function historyPreview(entry: OutlookHistoryEntry, maxLen = 72): string {
  const raw = entry.originalBody.trim().replace(/\s+/g, ' ');
  if (!raw) return '(empty draft)';
  return raw.length <= maxLen ? raw : `${raw.slice(0, maxLen)}…`;
}

export function formatHistoryMeta(entry: OutlookHistoryEntry): string {
  const d = new Date(entry.timestamp);
  const when = d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${when} · ${entry.tone} · ${entry.length}`;
}

export function snapshotFromHistoryOriginal(
  entry: OutlookHistoryEntry,
): MessageBodySnapshot {
  return {
    editableText: entry.originalBody,
    previewText: entry.originalBody,
    signatureText: '',
    bodyHtml: '',
    signatureHtml: entry.signatureHtml ?? '',
    fullHtml: entry.originalFullHtml ?? entry.originalBody,
    fullText: entry.originalBody,
  };
}

export function snapshotFromHistoryGenerated(
  entry: OutlookHistoryEntry,
): MessageBodySnapshot {
  return {
    editableText: entry.generatedBody,
    previewText: entry.generatedBody,
    signatureText: '',
    bodyHtml: plainTextToHtml(entry.generatedBody, entry.generatedFullHtml ?? ''),
    signatureHtml: entry.signatureHtml ?? '',
    fullHtml: entry.generatedFullHtml ?? entry.generatedBody,
    fullText: entry.generatedBody,
  };
}

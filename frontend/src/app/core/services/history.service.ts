import { computed, Injectable, signal } from '@angular/core';

export interface HistoryEntry {
  id: string;
  taskType: string;
  inputSummary: string;
  /** Full form values at generation time (for restore). Omitted on older saved entries. */
  inputs?: Record<string, string>;
  output: string;
  timestamp: number;
}

const STORAGE_KEY = 'workdesk_history';
const FAVORITES_KEY = 'workdesk_favorites';
const MAX_ENTRIES = 50;
const MAX_OUTPUT_BYTES = 20_000;
const MAX_INPUT_BYTES = 30_000;

function newEntryId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `h-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

@Injectable({ providedIn: 'root' })
export class HistoryService {
  private readonly version = signal(0);

  readonly entries = computed(() => {
    this.version();
    return this.readList();
  });

  add(taskType: string, inputs: Record<string, string>, output: string): void {
    const storedInputs = trimInputs(inputs);
    const inputSummary = buildInputSummary(storedInputs);
    let trimmedOutput = output;
    const encoder = new TextEncoder();
    if (encoder.encode(trimmedOutput).length > MAX_OUTPUT_BYTES) {
      while (encoder.encode(trimmedOutput).length > MAX_OUTPUT_BYTES) {
        trimmedOutput = trimmedOutput.slice(0, -200);
      }
    }
    const entry: HistoryEntry = {
      id: newEntryId(),
      taskType,
      inputSummary,
      inputs: storedInputs,
      output: trimmedOutput,
      timestamp: Date.now(),
    };
    const list = [entry, ...this.readList().filter((e) => e.id !== entry.id)].slice(0, MAX_ENTRIES);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      this.version.update((v) => v + 1);
    } catch {
      // Storage blocked (private mode, policy, etc.)
    }
  }

  list(): HistoryEntry[] {
    return this.entries();
  }

  getById(id: string): HistoryEntry | undefined {
    return this.readList().find((e) => e.id === id);
  }

  remove(id: string): void {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(this.readList().filter((e) => e.id !== id)),
    );
    this.version.update((v) => v + 1);
  }

  clearAll(): void {
    localStorage.removeItem(STORAGE_KEY);
    this.version.update((v) => v + 1);
  }

  getFavorites(): string[] {
    try {
      return JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? '[]') as string[];
    } catch {
      return [];
    }
  }

  isFavorite(taskType: string): boolean {
    return this.getFavorites().includes(taskType);
  }

  toggleFavorite(taskType: string): boolean {
    const favs = this.getFavorites();
    const next = favs.includes(taskType)
      ? favs.filter((f) => f !== taskType)
      : [...favs, taskType];
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
    return next.includes(taskType);
  }

  private readList(): HistoryEntry[] {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as HistoryEntry[];
    } catch {
      return [];
    }
  }
}

function trimInputs(inputs: Record<string, string>): Record<string, string> {
  const encoder = new TextEncoder();
  const out: Record<string, string> = {};
  let totalBytes = 0;

  for (const [key, raw] of Object.entries(inputs)) {
    if (!raw) continue;
    let value = raw;
    const keyBytes = encoder.encode(key).length;
    let valueBytes = encoder.encode(value).length;
    while (totalBytes + keyBytes + valueBytes > MAX_INPUT_BYTES && value.length > 0) {
      value = value.slice(0, -200);
      valueBytes = encoder.encode(value).length;
    }
    if (!value) continue;
    out[key] = value;
    totalBytes += keyBytes + valueBytes;
  }

  return out;
}

/** Sidebar title from the main text field, with light cleanup for code/docstrings. */
function buildInputSummary(inputs: Record<string, string>): string {
  const primary =
    inputs['user_input']?.trim() ||
    inputs['input']?.trim() ||
    inputs['criteria']?.trim() ||
    Object.values(inputs).find((v) => v.trim().length > 0)?.trim() ||
    '';
  return cleanSummaryText(primary).slice(0, 120);
}

function cleanSummaryText(text: string): string {
  let s = text.replace(/\s+/g, ' ').trim();
  s = s.replace(/^(\/\/|#|\/\*|\*+|"""+|'''+|`{3,})\s*/, '');
  return s.trim();
}

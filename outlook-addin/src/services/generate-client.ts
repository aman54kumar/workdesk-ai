import { apiUrl } from './api-config';
import {
  buildGeneratePayload,
  getCachedLlmOptions,
  loadLlmSettings,
} from './llm-settings';

export const MAX_INPUT_CHARS = 20000;

export interface StreamResult {
  chunk?: string;
  cacheHit?: boolean;
  truncated?: boolean;
  incomplete?: boolean;
  queued?: { position: number; eta_s: number; job_id?: string };
  started?: boolean;
  done?: { cached: boolean; model?: string };
  error?: string;
}

export interface StreamCallbacks {
  onFrame: (r: StreamResult) => void;
  onError: (message: string) => void;
  onComplete: () => void;
}

let maxInputChars = MAX_INPUT_CHARS;
let limitsLoaded = false;

export function getMaxInputChars(): number {
  return maxInputChars;
}

export async function loadLimits(): Promise<void> {
  if (limitsLoaded) return;
  limitsLoaded = true;
  try {
    const r = await fetch(apiUrl('/generate/limits'));
    if (!r.ok) return;
    const data = (await r.json()) as { max_input_chars?: number };
    if (data.max_input_chars) maxInputChars = data.max_input_chars;
  } catch {
    /* ignore */
  }
}

export function validateInputSize(variables: Record<string, string>): string | null {
  const total = Object.values(variables).reduce((n, v) => n + v.length, 0);
  if (total > maxInputChars) {
    return `Input is too long (${total.toLocaleString()} characters). Maximum is ${maxInputChars.toLocaleString()}.`;
  }
  return null;
}

const ERROR_MESSAGES: Record<string, string> = {
  timeout: 'Generation timed out. Please try again with shorter input.',
  cancelled: 'Request cancelled.',
  'generation incomplete': 'The connection to the AI model ended early. Try again.',
  'generation failed': 'Generation failed. Please try again.',
};

export function applyStreamFrame(r: StreamResult, ctx: {
  appendChunk: (c: string) => void;
  setCacheHit: (v: boolean) => void;
  setQueued: (q: { position: number; eta_s: number } | null) => void;
  setError: (msg: string) => void;
}): void {
  if (r.queued) ctx.setQueued(r.queued);
  if (r.started) ctx.setQueued(null);
  if (r.cacheHit) ctx.setCacheHit(true);
  if (r.chunk) ctx.appendChunk(r.chunk);
  if (r.error) {
    ctx.setError(ERROR_MESSAGES[r.error] ?? r.error);
  }
}

export function streamGenerate(
  taskType: string,
  variables: Record<string, string>,
  skipCache = false,
): { cancel: () => void; run: (callbacks: StreamCallbacks) => Promise<void> } {
  const controller = new AbortController();
  let jobId: string | null = null;
  let finished = false;
  let sawDone = false;
  let sawToken = false;
  let stoppedByUser = false;

  const finish = () => {
    finished = true;
  };

  const cancel = () => {
    if (finished) return;
    stoppedByUser = true;
    finish();
    const id = jobId;
    if (id) {
      fetch(apiUrl('/generate/cancel'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: id }),
        keepalive: true,
      }).catch(() => undefined);
    }
    controller.abort();
  };

  const run = async (callbacks: StreamCallbacks) => {
    const sizeErr = validateInputSize(variables);
    if (sizeErr) {
      callbacks.onError(sizeErr);
      callbacks.onComplete();
      return;
    }

    const settings = loadLlmSettings();
    const llm = buildGeneratePayload(settings, getCachedLlmOptions());
    if (settings.source === 'cloud' && !llm) {
      callbacks.onError(
        'Cloud mode is selected but model or API key is missing. Open Settings.',
      );
      callbacks.onComplete();
      return;
    }

    const requestBody: Record<string, unknown> = {
      task_type: taskType,
      variables,
      skip_cache: skipCache,
      client_source: 'outlook',
    };
    if (llm) requestBody['llm'] = llm;

    try {
      const response = await fetch(apiUrl('/generate/stream'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const rawDetail = (body as { detail?: string | { msg: string }[] }).detail;
        const detail =
          typeof rawDetail === 'string'
            ? rawDetail
            : Array.isArray(rawDetail)
              ? rawDetail.map((d) => d.msg ?? JSON.stringify(d)).join('; ')
              : undefined;
        callbacks.onError(
          response.status === 413
            ? (detail ?? 'Input too long')
            : (detail ?? 'Generation failed. Please try again.'),
        );
        callbacks.onComplete();
        return;
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let closed = false;

      const close = (incomplete = false) => {
        if (closed) return;
        closed = true;
        if (incomplete && !sawDone) {
          callbacks.onFrame({ incomplete: true });
        }
        finish();
        callbacks.onComplete();
      };

      const handleFrame = (frame: Record<string, unknown>) => {
        const type = frame['type'] as string;
        switch (type) {
          case 'queued':
            if (typeof frame['job_id'] === 'string') {
              jobId = frame['job_id'] as string;
            }
            callbacks.onFrame({
              queued: {
                position: frame['position'] as number,
                eta_s: frame['eta_s'] as number,
                job_id: frame['job_id'] as string | undefined,
              },
            });
            break;
          case 'start':
            callbacks.onFrame({ started: true, cacheHit: false });
            break;
          case 'token':
            sawToken = true;
            callbacks.onFrame({ chunk: frame['t'] as string });
            break;
          case 'truncated':
            callbacks.onFrame({ truncated: true });
            break;
          case 'done':
            sawDone = true;
            callbacks.onFrame({
              done: {
                cached: !!frame['cached'],
                model: frame['model'] as string | undefined,
              },
            });
            if (frame['cached']) callbacks.onFrame({ cacheHit: true });
            close(false);
            break;
          case 'error':
            callbacks.onFrame({ error: (frame['msg'] as string) ?? 'error' });
            close(false);
            break;
        }
      };

      const read = async (): Promise<void> => {
        const { done, value } = await reader.read();
        if (done) {
          close(!sawDone);
          return;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            handleFrame(JSON.parse(trimmed));
          } catch {
            /* malformed */
          }
        }
        if (!closed) await read();
      };

      await read();
    } catch (err) {
      const e = err as { name?: string };
      if (e?.name === 'AbortError') {
        if (!stoppedByUser && sawToken && !sawDone) {
          callbacks.onFrame({ incomplete: true });
        }
        callbacks.onComplete();
        return;
      }
      finish();
      callbacks.onError(
        err instanceof Error ? err.message : 'Network error. Check API URL in Settings.',
      );
      callbacks.onComplete();
    }
  };

  return { cancel, run };
}

/** Start streaming; returns cancel handle. */
export function startStreamGenerate(
  taskType: string,
  variables: Record<string, string>,
  callbacks: StreamCallbacks,
  skipCache = false,
): () => void {
  const { cancel, run } = streamGenerate(taskType, variables, skipCache);
  void run(callbacks);
  return cancel;
}

export async function testApiConnection(): Promise<string> {
  const r = await fetch(apiUrl('/generate/limits'));
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return 'Connected to WorkDesk API.';
}

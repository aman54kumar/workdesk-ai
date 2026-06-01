import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

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

export interface StreamHandle {
  observable: Observable<StreamResult>;
  cancel: () => void;
}

export interface CompanyProfileSectionPublic {
  label: string;
  content: string;
}

export interface CompanyProfileStatus {
  available: boolean;
  section_labels: string[];
  sections: CompanyProfileSectionPublic[];
}

@Injectable({ providedIn: 'root' })
export class GenerateService {
  private limitsLoaded = false;
  maxInputChars = MAX_INPUT_CHARS;

  loadLimits(): void {
    if (this.limitsLoaded) return;
    this.limitsLoaded = true;
    fetch(`${environment.apiUrl}/generate/limits`)
      .then((r) => r.json())
      .then((data: { max_input_chars?: number }) => {
        if (data.max_input_chars) this.maxInputChars = data.max_input_chars;
      })
      .catch(() => undefined);
  }

  fetchCompanyProfileStatus(): Promise<CompanyProfileStatus> {
    return fetch(`${environment.apiUrl}/generate/company-profile-status`)
      .then((r) => {
        if (!r.ok) throw new Error('status failed');
        return r.json() as Promise<CompanyProfileStatus>;
      });
  }

  validateInputSize(variables: Record<string, string>): string | null {
    const total = Object.values(variables).reduce((n, v) => n + v.length, 0);
    if (total > this.maxInputChars) {
      return `Input is too long (${total.toLocaleString()} characters). Maximum is ${this.maxInputChars.toLocaleString()}.`;
    }
    return null;
  }

  streamGenerate(
    taskType: string,
    variables: Record<string, string>,
    skipCache = false,
  ): StreamHandle {
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
        fetch(`${environment.apiUrl}/generate/cancel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ job_id: id }),
          keepalive: true,
        }).catch(() => undefined);
      }
      controller.abort();
    };

    const observable = new Observable<StreamResult>((observer) => {
      let closed = false;

      const close = (incomplete = false) => {
        if (closed) return;
        closed = true;
        if (incomplete && !sawDone) {
          observer.next({ incomplete: true });
        }
        finish();
        observer.complete();
      };

      fetch(`${environment.apiUrl}/generate/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_type: taskType,
          variables,
          skip_cache: skipCache,
        }),
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) {
            if (response.status === 413) {
              const body = await response.json().catch(() => ({}));
              finish();
              observer.error({
                status: 413,
                message: (body as { detail?: string }).detail ?? 'Input too long',
              });
              return;
            }
            finish();
            observer.error({ status: response.status });
            return;
          }

          const reader = response.body!.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          const handleFrame = (frame: Record<string, unknown>) => {
            const type = frame['type'] as string;
            switch (type) {
              case 'queued':
                if (typeof frame['job_id'] === 'string') {
                  jobId = frame['job_id'] as string;
                }
                observer.next({
                  queued: {
                    position: frame['position'] as number,
                    eta_s: frame['eta_s'] as number,
                    job_id: frame['job_id'] as string | undefined,
                  },
                });
                break;
              case 'start':
                observer.next({ started: true, cacheHit: false });
                break;
              case 'token':
                sawToken = true;
                observer.next({ chunk: frame['t'] as string });
                break;
              case 'truncated':
                observer.next({ truncated: true });
                break;
              case 'done':
                sawDone = true;
                observer.next({
                  done: {
                    cached: !!frame['cached'],
                    model: frame['model'] as string | undefined,
                  },
                });
                if (frame['cached']) observer.next({ cacheHit: true });
                close(false);
                break;
              case 'error':
                observer.next({ error: (frame['msg'] as string) ?? 'error' });
                close(false);
                break;
            }
          };

          const read = (): void => {
            reader
              .read()
              .then(({ done, value }) => {
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
                    /* ignore malformed */
                  }
                }
                if (!closed) read();
              })
              .catch((err) => {
                if (err?.name === 'AbortError') {
                  if (!stoppedByUser && sawToken && !sawDone) {
                    close(true);
                    return;
                  }
                  close(false);
                  return;
                }
                finish();
                observer.error(err);
              });
          };

          read();
        })
        .catch((err) => {
          if (err?.name === 'AbortError') {
            if (!stoppedByUser && sawToken && !sawDone) {
              close(true);
              return;
            }
            close(false);
            return;
          }
          finish();
          observer.error(err);
        });

      return () => {
        closed = true;
      };
    });

    return { observable, cancel };
  }
}

/** Apply a stream frame to common tool UI signals. */
export function applyStreamFrame(
  r: StreamResult,
  ctx: {
    appendChunk: (c: string) => void;
    setCacheHit: (v: boolean) => void;
    setQueued: (q: { position: number; eta_s: number } | null) => void;
    setError: (msg: string) => void;
    setTruncatedWarning?: (msg: string) => void;
  },
): void {
  if (r.queued) ctx.setQueued(r.queued);
  if (r.started) ctx.setQueued(null);
  if (r.cacheHit) ctx.setCacheHit(true);
  if (r.chunk) ctx.appendChunk(r.chunk);
  if (r.truncated && ctx.setTruncatedWarning) {
    ctx.setTruncatedWarning(
      'The response was cut off at the model token limit. Click Regenerate to try again.',
    );
  }
  if (r.error) {
    const msg =
      r.error === 'timeout'
        ? 'Generation timed out. Please try again with shorter input.'
        : r.error === 'cancelled'
          ? 'Request cancelled.'
          : r.error === 'generation incomplete'
            ? 'The connection to the AI model ended early. Try again.'
            : 'Generation failed. Please try again.';
    ctx.setError(msg);
  }
}

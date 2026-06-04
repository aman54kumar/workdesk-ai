import { WritableSignal } from '@angular/core';
import { Subscription } from 'rxjs';
import {
  applyStreamFrame,
  GenerateService,
  StreamResult,
} from '../services/generate.service';
import { HistoryService } from '../services/history.service';

export interface ToolGenerationSignals {
  outputText: WritableSignal<string>;
  loading: WritableSignal<boolean>;
  cacheHit: WritableSignal<boolean>;
  errorMessage: WritableSignal<string>;
  queuePosition: WritableSignal<number>;
  queueEta: WritableSignal<number>;
  lastModel: WritableSignal<string>;
}

export function startToolGeneration(
  gs: GenerateService,
  history: HistoryService,
  taskType: string,
  variables: Record<string, string>,
  state: ToolGenerationSignals,
  skipCache = false,
): () => void {
  const sizeErr = gs.validateInputSize(variables);
  if (sizeErr) {
    state.errorMessage.set(sizeErr);
    return () => undefined;
  }

  if (state.loading()) {
    return () => undefined;
  }

  state.outputText.set('');
  state.errorMessage.set('');
  state.loading.set(true);
  state.cacheHit.set(false);
  state.queuePosition.set(0);
  state.queueEta.set(0);

  const handle = gs.streamGenerate(taskType, variables, skipCache);
  let assembled = '';
  let stoppedByUser = false;
  let streamClosed = false;
  let sawDone = false;
  let sawIncomplete = false;

  const subscription: Subscription = handle.observable.subscribe({
    next: (r: StreamResult) => {
      applyStreamFrame(r, {
        appendChunk: (c) => {
          assembled += c;
          state.outputText.update((t) => t + c);
        },
        setCacheHit: (v) => state.cacheHit.set(v),
        setQueued: (q) => {
          state.queuePosition.set(q?.position ?? 0);
          state.queueEta.set(q?.eta_s ?? 0);
        },
        setError: (msg) => {
          if (stoppedByUser && msg === 'Request cancelled.') {
            return;
          }
          state.errorMessage.set(msg);
        },
      });
      if (r.done) sawDone = true;
      if (r.done?.model) state.lastModel.set(r.done.model);
      if (r.incomplete) {
        sawIncomplete = true;
        if (!stoppedByUser) {
          state.errorMessage.set(
            'The connection ended before generation finished. Try again.',
          );
        }
      }
    },
    error: (err: { status?: number; message?: string }) => {
      streamClosed = true;
      state.loading.set(false);
      state.queuePosition.set(0);
      if (stoppedByUser) return;
      if (err?.status === 413) {
        state.errorMessage.set(err.message ?? 'Input too long.');
      } else if (err?.message) {
        state.errorMessage.set(err.message);
      } else {
        state.errorMessage.set('Generation failed. Please try again.');
      }
    },
    complete: () => {
      streamClosed = true;
      state.loading.set(false);
      state.queuePosition.set(0);
      state.queueEta.set(0);
      if (assembled.trim() && !stoppedByUser && sawDone && !sawIncomplete) {
        history.add(taskType, variables, assembled);
      }
    },
  });

  return () => {
    if (streamClosed) return;
    stoppedByUser = true;
    state.errorMessage.set('');
    state.queuePosition.set(0);
    state.queueEta.set(0);
    handle.cancel();
    subscription.unsubscribe();
  };
}

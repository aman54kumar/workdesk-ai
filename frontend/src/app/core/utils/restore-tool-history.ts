import { HistoryEntry } from '../services/history.service';

export interface RestoreToolHistoryOptions {
  /** Apply saved form values (full inputs from history). */
  applyInputs: (inputs: Record<string, string>) => void;
  /** Apply saved model output. */
  setOutput: (output: string) => void;
}

/** Restore inputs and output when opening a recent/history entry. */
export function restoreFromHistory(
  entry: HistoryEntry | null,
  options: RestoreToolHistoryOptions,
): void {
  if (!entry) return;
  if (entry.inputs && Object.keys(entry.inputs).length > 0) {
    options.applyInputs(entry.inputs);
  }
  options.setOutput(entry.output);
}

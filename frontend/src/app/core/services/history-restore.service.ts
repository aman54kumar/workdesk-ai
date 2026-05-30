import { Injectable, signal } from '@angular/core';
import { HistoryEntry } from './history.service';

@Injectable({ providedIn: 'root' })
export class HistoryRestoreService {
  readonly pending = signal<HistoryEntry | null>(null);

  request(entry: HistoryEntry): void {
    this.pending.set(entry);
  }

  consume(taskType: string): HistoryEntry | null {
    const entry = this.pending();
    if (!entry || entry.taskType !== taskType) return null;
    this.pending.set(null);
    return entry;
  }
}

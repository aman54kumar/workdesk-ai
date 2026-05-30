import { Injectable, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'workdesk_theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly mode = signal<ThemeMode>('light');

  constructor() {
    const stored = localStorage.getItem(STORAGE_KEY);
    const initial: ThemeMode = stored === 'dark' || stored === 'light' ? stored : 'light';
    this.apply(initial);
  }

  toggle(): void {
    this.apply(this.mode() === 'light' ? 'dark' : 'light');
  }

  private apply(mode: ThemeMode): void {
    this.mode.set(mode);
    localStorage.setItem(STORAGE_KEY, mode);
    document.documentElement.classList.toggle('dark', mode === 'dark');
    document.documentElement.style.colorScheme = mode;
  }
}

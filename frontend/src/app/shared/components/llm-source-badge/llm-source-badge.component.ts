import { Component, inject } from '@angular/core';
import { LlmSettingsService } from '../../../core/services/llm-settings.service';

@Component({
  selector: 'app-llm-source-badge',
  standalone: true,
  template: `
    <div class="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-stroke/70 bg-surface/60 px-3 py-2 text-xs">
      <div class="flex min-w-0 items-center gap-2 text-muted">
        <svg class="h-3.5 w-3.5 flex-shrink-0 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
        </svg>
        <span class="truncate">Using: <span class="font-medium text-content">{{ llm.effectiveLabel() }}</span></span>
      </div>
      <button type="button" class="btn-ghost text-[11px]" (click)="llm.openAiSettings()">Change</button>
    </div>
  `,
})
export class LlmSourceBadgeComponent {
  llm = inject(LlmSettingsService);
}

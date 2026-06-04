import { Component, inject, Input } from '@angular/core';
import { LlmSettingsService } from '../../../core/services/llm-settings.service';

@Component({
  selector: 'app-queue-status',
  standalone: true,
  template: `
    @if (!llm.isCloud() && position > 0) {
      <div
        class="mb-4 rounded-xl border border-accent/25 bg-accent/8 px-4 py-3 text-sm text-content"
      >
        You're <span class="font-semibold text-accent">#{{ position }}</span> in line
        @if (etaS > 0) {
          <span class="text-muted"> · ~{{ etaS }}s wait</span>
        }
      </div>
    }
  `,
})
export class QueueStatusComponent {
  llm = inject(LlmSettingsService);
  @Input() position = 0;
  @Input() etaS = 0;
}

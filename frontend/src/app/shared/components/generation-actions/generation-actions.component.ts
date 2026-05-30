import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-generation-actions',
  standalone: true,
  template: `
    @if (loading) {
      <button type="button" class="btn-secondary" (click)="stop.emit()">Stop</button>
    } @else {
      <button type="button" class="btn-primary" [disabled]="disabled" (click)="generate.emit()">
        {{ label }}
      </button>
    }
  `,
})
export class GenerationActionsComponent {
  @Input() label = 'Generate';
  @Input() loading = false;
  @Input() disabled = false;
  @Output() generate = new EventEmitter<void>();
  @Output() stop = new EventEmitter<void>();
}

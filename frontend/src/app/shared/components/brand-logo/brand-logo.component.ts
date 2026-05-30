import { Component, Input, computed, inject } from '@angular/core';
import { ThemeService } from '../../../core/services/theme.service';

@Component({
  selector: 'app-brand-logo',
  standalone: true,
  template: `
    <img
      [src]="iconSrc()"
      [attr.alt]="decorative ? '' : 'WorkDesk AI'"
      [attr.width]="size"
      [attr.height]="size"
      [attr.aria-hidden]="decorative ? 'true' : null"
      [attr.role]="decorative ? null : 'img'"
      [attr.aria-label]="decorative ? null : 'WorkDesk AI'"
      class="flex-shrink-0"
      decoding="async"
    />
  `,
})
export class BrandLogoComponent {
  private theme = inject(ThemeService);

  @Input() size = 32;
  @Input() decorative = false;

  iconSrc = computed(() =>
    this.theme.mode() === 'dark' ? 'workdesk-ai-icon.svg' : 'workdesk-ai-icon-light.svg',
  );
}

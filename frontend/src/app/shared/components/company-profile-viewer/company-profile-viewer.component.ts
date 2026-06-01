import { Component, input, signal } from '@angular/core';

export interface CompanyProfileSectionView {
  label: string;
  content: string;
}

@Component({
  selector: 'app-company-profile-viewer',
  standalone: true,
  template: `
    <div class="profile-viewer rounded-xl border border-stroke/80 bg-surface-raised/50">
      <button
        type="button"
        class="profile-viewer-toggle flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium text-content transition-colors hover:text-accent"
        (click)="expanded.set(!expanded())"
        [attr.aria-expanded]="expanded()"
      >
        <span class="flex items-center gap-2">
          <svg class="h-4 w-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          {{ expanded() ? 'Hide' : 'View' }} company profile
        </span>
        <svg
          class="h-4 w-4 flex-shrink-0 text-muted transition-transform duration-200"
          [class.rotate-180]="expanded()"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
        </svg>
      </button>

      @if (expanded()) {
        <div class="profile-viewer-body border-t border-stroke/60 px-4 py-3">
          <p class="mb-3 text-[11px] leading-relaxed text-faint">
            Read-only copy of what your admin saved. Edits are made in Admin → Company profile.
          </p>
          <div class="profile-viewer-scroll max-h-[min(320px,50vh)] space-y-4 overflow-y-auto pr-1">
            @for (section of sections(); track section.label) {
              <section>
                <h3 class="text-[11px] font-semibold uppercase tracking-[0.12em] text-accent">
                  {{ section.label }}
                </h3>
                <p class="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-content/90">
                  {{ section.content }}
                </p>
              </section>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    html:not(.dark) .profile-viewer {
      background: rgb(255 255 255 / 0.55);
      box-shadow: inset 0 1px 2px rgb(15 23 42 / 0.03);
    }

    html.dark .profile-viewer {
      background: rgb(var(--c-surface-raised) / 0.45);
    }

    .profile-viewer-toggle:focus-visible {
      outline: none;
      box-shadow: inset 0 0 0 2px rgb(var(--c-accent) / 0.35);
      border-radius: 0.75rem;
    }

    .profile-viewer-scroll::-webkit-scrollbar {
      width: 5px;
    }
    .profile-viewer-scroll::-webkit-scrollbar-thumb {
      background: rgb(var(--c-stroke));
      border-radius: 99px;
    }
  `,
})
export class CompanyProfileViewerComponent {
  sections = input.required<CompanyProfileSectionView[]>();
  expanded = signal(false);
}

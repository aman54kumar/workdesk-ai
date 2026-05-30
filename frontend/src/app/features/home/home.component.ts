import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toolIconAccent, toolIconPath } from '../../core/constants/tool-icons';
import { PublicTask, TasksService } from '../../core/services/tasks.service';
import { BrandLogoComponent } from '../../shared/components/brand-logo/brand-logo.component';

interface ToolSection {
  section: string;
  blurb: string;
  tasks: PublicTask[];
}

interface Benefit {
  title: string;
  body: string;
  icon: string;
}

interface TrustSignal {
  title: string;
  body: string;
  icon: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, BrandLogoComponent],
  template: `
    <div class="home-page mx-auto w-full max-w-7xl px-1 pb-10 pt-2 md:px-2">
      <section class="command-hero relative overflow-hidden rounded-[2rem] border border-stroke/80 px-5 py-6 md:px-8 md:py-8 xl:px-10">
        <div class="command-grid pointer-events-none absolute inset-0" aria-hidden="true"></div>
        <div class="command-glow pointer-events-none absolute inset-0" aria-hidden="true"></div>

        <div class="relative z-[1] grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(380px,0.95fr)] xl:items-stretch">
          <div class="flex min-h-0 flex-col xl:justify-center">
            <div class="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-300">
              <span class="home-live-dot h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
              Local AI command center
            </div>

            <div class="mb-5 flex items-start gap-4">
              <app-brand-logo [size]="52" [decorative]="true" />
              <div>
                <p class="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-faint">WorkDesk AI</p>
                <h1 class="max-w-3xl text-3xl font-bold tracking-tight text-content md:text-5xl md:leading-[1.05]">
                  AI-powered writing tools, hosted and managed by Adit.
                </h1>
              </div>
            </div>

            <p class="max-w-2xl text-base leading-relaxed text-muted md:text-lg">
              WorkDesk AI helps teams draft emails, summarise meetings, improve tone, translate content, and more —
              all processed on the local Adit AI server, with nothing sent to external services.
            </p>
          </div>

          <div class="command-panel rounded-[1.6rem] border border-stroke/70 p-5 md:p-6">
            <div class="mb-4">
              <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">About this workspace</p>
              <h2 class="mt-1 text-xl font-semibold text-content">Built for the way Adit works.</h2>
              <p class="mt-2 text-sm leading-relaxed text-muted">
                A local writing assistant designed for internal teams — not a generic public AI service.
              </p>
            </div>

            <div class="space-y-2.5">
              @for (benefit of benefits; track benefit.title) {
                <div class="benefit-row">
                  <span class="benefit-icon">
                    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" [attr.d]="benefit.icon"/>
                    </svg>
                  </span>
                  <div>
                    <p class="text-sm font-semibold text-content">{{ benefit.title }}</p>
                    <p class="mt-0.5 text-xs leading-relaxed text-muted">{{ benefit.body }}</p>
                  </div>
                </div>
              }
            </div>
          </div>
        </div>
      </section>

      <section class="mt-5 grid gap-3 lg:grid-cols-3">
        @for (signal of trustSignals; track signal.title) {
          <div class="trust-card">
            <div class="trust-icon">
              <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" [attr.d]="signal.icon"/>
              </svg>
            </div>
            <div>
              <h2 class="text-sm font-semibold text-content">{{ signal.title }}</h2>
              <p class="mt-1 text-xs leading-relaxed text-muted">{{ signal.body }}</p>
            </div>
          </div>
        }
      </section>

      <section class="mt-5 rounded-[1.4rem] border border-accent/20 bg-accent/5 px-5 py-5 md:flex md:items-center md:justify-between md:gap-6">
        <div>
          <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">Help shape WorkDesk AI</p>
          <h2 class="mt-1 text-lg font-semibold text-content">Share feedback, issues, or ideas for upcoming tools.</h2>
          <p class="mt-1 max-w-2xl text-sm leading-relaxed text-muted">
            Your input helps us improve the app and prioritise the next capabilities for internal teams.
          </p>
        </div>
        <a routerLink="/feedback" class="home-cta-primary mt-4 md:mt-0">Send feedback</a>
      </section>

      <section id="tools" class="tools-panel mt-8 rounded-[1.6rem] border border-stroke/75 px-5 py-6 md:px-7 md:py-7">
        @if (loading()) {
          <div class="mb-5 flex flex-wrap gap-2">
            @for (n of [1, 2, 3, 4]; track n) {
              <div class="home-skeleton h-9 w-24 rounded-full"></div>
            }
          </div>
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            @for (n of skeletonSlots; track n) {
              <div class="home-skeleton h-[88px] rounded-xl"></div>
            }
          </div>
        } @else if (toolCount() === 0) {
          <div class="empty-command rounded-xl border border-dashed border-stroke px-6 py-12 text-center">
            <div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
              <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M12 3l7 3v6c0 4.4-3 7.8-7 9-4-1.2-7-4.6-7-9V6l7-3z"/>
              </svg>
            </div>
            <p class="text-base font-semibold text-content">No tools are available yet</p>
            <p class="mx-auto mt-2 max-w-md text-sm text-muted">
              Tools will appear here once the workspace is set up. Check back shortly.
            </p>
          </div>
        } @else {
          <div class="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">Tool library</p>
              <h2 class="mt-1 text-xl font-semibold tracking-tight text-content md:text-2xl">
                {{ toolCount() }} tool{{ toolCount() === 1 ? '' : 's' }} available
              </h2>
              @if (activeSectionBlurb(); as blurb) {
                <p class="mt-1.5 max-w-2xl text-sm text-muted">{{ blurb }}</p>
              }
            </div>
          </div>

          @if (sectionGroups().length > 1) {
            <div class="mb-5 flex flex-wrap gap-2" role="tablist" aria-label="Filter by team">
              <button
                type="button"
                role="tab"
                class="section-tab"
                [class.section-tab-active]="selectedSection() === 'all'"
                [attr.aria-selected]="selectedSection() === 'all'"
                (click)="selectSection('all')"
              >
                All
                <span class="section-tab-count">{{ toolCount() }}</span>
              </button>
              @for (group of sectionGroups(); track group.section) {
                <button
                  type="button"
                  role="tab"
                  class="section-tab"
                  [class.section-tab-active]="selectedSection() === group.section"
                  [attr.aria-selected]="selectedSection() === group.section"
                  (click)="selectSection(group.section)"
                >
                  {{ group.section }}
                  <span class="section-tab-count">{{ group.tasks.length }}</span>
                </button>
              }
            </div>
          }

          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            @for (task of displayedTools(); track task.task_type) {
              <a [routerLink]="task.path" class="tool-tile group">
                <span
                  class="tool-tile-icon"
                  [class]="iconAccent(task.icon).bg + ' ' + iconAccent(task.icon).text"
                >
                  <svg class="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" [attr.d]="iconPath(task.icon)"/>
                  </svg>
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm font-semibold text-content">{{ task.display_name }}</span>
                  <span class="tool-tile-desc mt-0.5 block text-xs leading-snug text-muted">{{ task.description }}</span>
                </span>
                <svg class="tool-tile-arrow h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                </svg>
              </a>
            }
          </div>
        }
      </section>
    </div>
  `,
  styles: `
    .command-hero {
      background:
        linear-gradient(135deg, rgb(var(--c-surface) / 0.96) 0%, rgb(var(--c-surface-raised) / 0.86) 48%, rgb(var(--c-canvas) / 0.94) 100%);
      box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.05);
    }

    .command-grid {
      background-image:
        linear-gradient(rgb(var(--c-stroke) / 0.18) 1px, transparent 1px),
        linear-gradient(90deg, rgb(var(--c-stroke) / 0.18) 1px, transparent 1px);
      background-size: 42px 42px;
      mask-image: radial-gradient(circle at 50% 35%, black, transparent 72%);
      opacity: 0.42;
    }

    .command-glow {
      background:
        radial-gradient(circle at 12% 18%, rgb(var(--c-accent) / 0.2), transparent 35%),
        radial-gradient(circle at 82% 12%, rgb(16 185 129 / 0.14), transparent 34%),
        radial-gradient(circle at 72% 92%, rgb(14 165 233 / 0.13), transparent 38%);
    }

    .home-live-dot {
      animation: home-pulse 2s ease-in-out infinite;
      box-shadow: 0 0 0 6px rgb(52 211 153 / 0.12);
    }

    @keyframes home-pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.55; transform: scale(0.92); }
    }

    .command-panel {
      background: rgb(var(--c-surface) / 0.72);
      backdrop-filter: blur(16px);
      box-shadow: 0 20px 60px rgb(0 0 0 / 0.12), inset 0 1px 0 rgb(255 255 255 / 0.04);
    }

    .benefit-row {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      border-radius: 0.95rem;
      border: 1px solid rgb(var(--c-stroke) / 0.55);
      background: linear-gradient(180deg, rgb(var(--c-canvas) / 0.42), rgb(var(--c-surface) / 0.35));
      padding: 0.8rem 1rem;
    }

    .benefit-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      width: 2rem;
      height: 2rem;
      border-radius: 0.6rem;
      background: linear-gradient(135deg, rgb(var(--c-accent) / 0.15), rgb(16 185 129 / 0.1));
      color: rgb(var(--c-accent));
    }

    .home-cta-primary {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      border-radius: 0.85rem;
      font-size: 0.875rem;
      background: rgb(var(--c-accent));
      padding: 0.65rem 1.1rem;
      font-weight: 600;
      color: white;
      transition: transform 0.15s ease, background-color 0.15s ease;
    }

    .home-cta-primary:hover {
      background: rgb(var(--c-accent-hover));
      transform: translateY(-1px);
    }

    .trust-icon,
    .tool-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .tool-icon {
      width: 2.75rem;
      height: 2.75rem;
      border: 1px solid rgb(var(--c-stroke) / 0.4);
      border-radius: 0.95rem;
    }

    .trust-card {
      display: flex;
      gap: 0.9rem;
      border: 1px solid rgb(var(--c-stroke) / 0.7);
      border-radius: 1.15rem;
      background: rgb(var(--c-surface) / 0.55);
      padding: 1rem 1.1rem;
    }

    .trust-icon {
      width: 2.25rem;
      height: 2.25rem;
      border-radius: 0.75rem;
      background: linear-gradient(135deg, rgb(var(--c-accent) / 0.15), rgb(16 185 129 / 0.12));
      color: rgb(var(--c-accent));
    }

    .tools-panel {
      background: rgb(var(--c-surface) / 0.55);
      backdrop-filter: blur(10px);
    }

    html:not(.dark) .tools-panel {
      background: rgb(255 255 255 / 0.62);
    }

    .section-tab {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      border: 1px solid rgb(var(--c-stroke) / 0.7);
      border-radius: 999px;
      background: rgb(var(--c-canvas) / 0.35);
      padding: 0.4rem 0.85rem;
      font-size: 0.8rem;
      font-weight: 500;
      color: rgb(var(--c-muted));
      transition: border-color 0.15s ease, background-color 0.15s ease, color 0.15s ease;
    }

    .section-tab:hover {
      border-color: rgb(var(--c-accent) / 0.35);
      color: rgb(var(--c-content));
    }

    .section-tab-active {
      border-color: rgb(var(--c-accent) / 0.45);
      background: rgb(var(--c-accent) / 0.12);
      color: rgb(var(--c-content));
      font-weight: 600;
    }

    .section-tab-count {
      display: inline-flex;
      min-width: 1.25rem;
      align-items: center;
      justify-content: center;
      border-radius: 999px;
      background: rgb(var(--c-stroke) / 0.35);
      padding: 0.05rem 0.4rem;
      font-size: 0.68rem;
      font-weight: 700;
      color: rgb(var(--c-faint));
    }

    .section-tab-active .section-tab-count {
      background: rgb(var(--c-accent) / 0.2);
      color: rgb(var(--c-accent));
    }

    .tool-tile {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      border: 1px solid rgb(var(--c-stroke) / 0.7);
      border-radius: 0.95rem;
      background: rgb(var(--c-surface) / 0.65);
      padding: 0.85rem 0.9rem;
      transition: border-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
    }

    html:not(.dark) .tool-tile {
      background: rgb(255 255 255 / 0.82);
    }

    .tool-tile:hover {
      transform: translateY(-1px);
      border-color: rgb(var(--c-accent) / 0.4);
      box-shadow: 0 8px 24px rgb(var(--c-accent) / 0.08);
    }

    .tool-tile-icon {
      display: inline-flex;
      width: 2.35rem;
      height: 2.35rem;
      flex-shrink: 0;
      align-items: center;
      justify-content: center;
      border-radius: 0.7rem;
    }

    .tool-tile-desc {
      display: -webkit-box;
      overflow: hidden;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
    }

    .tool-tile-arrow {
      color: rgb(var(--c-faint));
      transition: transform 0.15s ease, color 0.15s ease;
    }

    .tool-tile:hover .tool-tile-arrow {
      transform: translateX(2px);
      color: rgb(var(--c-accent));
    }

    .home-skeleton {
      animation: home-shimmer 1.4s ease-in-out infinite;
      background: linear-gradient(
        90deg,
        rgb(var(--c-surface-raised) / 0.5) 0%,
        rgb(var(--c-stroke) / 0.25) 50%,
        rgb(var(--c-surface-raised) / 0.5) 100%
      );
      background-size: 200% 100%;
    }

    @keyframes home-shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    .empty-command {
      background: rgb(var(--c-surface) / 0.35);
    }
  `,
})
export default class HomeComponent implements OnInit {
  private tasksSvc = inject(TasksService);

  loading = signal(true);
  skeletonSlots = [1, 2, 3, 4, 5, 6, 7, 8];
  selectedSection = signal<string>('all');

  readonly benefits: Benefit[] = [
    {
      title: 'Fully private',
      body: "All AI processing runs on Adit's local server. Work content never reaches an external service or public cloud.",
      icon: 'M12 3l7 3v6c0 4.4-3 7.8-7 9-4-1.2-7-4.6-7-9V6l7-3z',
    },
    {
      title: 'Managed by your team',
      body: "Tools are selected and maintained by the internal IT/AI team — kept relevant to Adit's actual workflows, not a generic audience.",
      icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
    },
    {
      title: 'No installation needed',
      body: 'Available in any browser on the Adit network. No downloads, no accounts, no setup.',
      icon: 'M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9',
    },
    {
      title: 'Grows with the business',
      body: 'New tools can be added, updated, or retired as workflows evolve — no vendor approvals or contract changes required.',
      icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
    },
  ];

  readonly trustSignals: TrustSignal[] = [
    {
      title: 'Hosted for internal work',
      body: 'Prompts and generated content are routed through the local Adit AI stack, not public AI services.',
      icon: 'M12 3l7 3v6c0 4.4-3 7.8-7 9-4-1.2-7-4.6-7-9V6l7-3z',
    },
    {
      title: "Tailored to Adit's workflows",
      body: 'The workspace is shaped by the internal team to match how Adit actually works — not built for a generic audience.',
      icon: 'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4',
    },
    {
      title: 'Professional output faster',
      body: 'Convert notes into structured emails, summaries, reports, and clear technical communication with less rework.',
      icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
    },
  ];

  private sectionBlurbs: Record<string, string> = {
    Everyone: 'Everyday writing helpers for the whole company.',
    'Delivery / PM': 'Keep stakeholders informed with structured project output.',
    Developers: 'Ship with clearer commits, bug reports, and code explanations.',
    'BD / Presales': 'Respond to opportunities with confident, human-sounding drafts.',
    Pinned: 'Your favourite tools, one click away.',
  };

  toolCount = computed(() => this.tasksSvc.tasks().length);

  sectionGroups = computed((): ToolSection[] => {
    const bySection = new Map<string, PublicTask[]>();
    for (const task of this.tasksSvc.tasks()) {
      const items = bySection.get(task.section) ?? [];
      items.push(task);
      bySection.set(task.section, items);
    }
    return [...bySection.entries()].map(([section, tasks]) => ({
      section,
      blurb: this.sectionBlurbs[section] ?? 'Tools curated for your workflow.',
      tasks,
    }));
  });

  displayedTools = computed((): PublicTask[] => {
    const section = this.selectedSection();
    if (section === 'all') {
      return this.tasksSvc.tasks();
    }
    return this.sectionGroups().find((g) => g.section === section)?.tasks ?? [];
  });

  activeSectionBlurb = computed((): string | null => {
    const section = this.selectedSection();
    if (section === 'all') {
      return 'Browse all available tools, or filter by team to narrow the list.';
    }
    return this.sectionGroups().find((g) => g.section === section)?.blurb ?? null;
  });

  ngOnInit(): void {
    if (this.tasksSvc.tasks().length > 0) {
      this.loading.set(false);
      return;
    }
    this.tasksSvc.ensureLoaded().subscribe({
      next: () => this.loading.set(false),
      error: () => this.loading.set(false),
    });
  }

  selectSection(section: string): void {
    this.selectedSection.set(section);
  }

  iconPath = toolIconPath;
  iconAccent = toolIconAccent;
}

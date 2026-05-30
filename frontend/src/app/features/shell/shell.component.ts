// frontend/src/app/features/shell/shell.component.ts

import { Component, computed, HostListener, inject, OnInit, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs/operators';
import { TasksService } from '../../core/services/tasks.service';
import { ThemeService } from '../../core/services/theme.service';
import { HistoryService, HistoryEntry } from '../../core/services/history.service';
import { HistoryRestoreService } from '../../core/services/history-restore.service';
import { BrandLogoComponent } from '../../shared/components/brand-logo/brand-logo.component';
import { toolIconPath } from '../../core/constants/tool-icons';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, BrandLogoComponent],
  template: `
    <div class="relative flex h-screen overflow-hidden bg-canvas text-content">

      <!-- ── Ambient glow orbs ──────────────────────────────── -->
      <div class="pointer-events-none fixed inset-0 z-0">
        @if (theme.mode() === 'dark') {
          <div class="absolute -top-32 right-16 h-[36rem] w-[36rem] rounded-full bg-indigo-500/10 blur-[120px]"></div>
          <div class="absolute -bottom-32 -left-16 h-[30rem] w-[30rem] rounded-full bg-sky-400/8 blur-[110px]"></div>
          <div class="absolute top-1/2 left-1/2 h-[20rem] w-[20rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-500/5 blur-[90px]"></div>
        } @else {
          <div class="absolute -top-24 right-10 h-[32rem] w-[32rem] rounded-full bg-indigo-400/12 blur-[110px]"></div>
          <div class="absolute -bottom-28 -left-12 h-[28rem] w-[28rem] rounded-full bg-cyan-400/10 blur-[100px]"></div>
        }
      </div>

      <!-- ── Sidebar ─────────────────────────────────────────── -->
      <aside
        class="app-sidebar relative z-10 m-3 flex h-[calc(100vh-1.5rem)] flex-shrink-0 flex-col overflow-hidden
               rounded-[1.65rem] transition-all duration-300 ease-in-out"
        [class.sidebar-dark]="theme.mode() === 'dark'"
        [class.sidebar-light]="theme.mode() === 'light'"
        [style.background]="sidebarBg"
        [class.w-[78px]]="sidebarCollapsed()"
        [class.w-[280px]]="!sidebarCollapsed()"
      >
        <!-- Sidebar inner glow -->
        <div class="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[1.65rem]">
          @if (theme.mode() === 'dark') {
            <div class="absolute -top-20 -right-10 h-48 w-48 rounded-full bg-indigo-400/12 blur-[60px]"></div>
            <div class="absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-violet-500/8 blur-[55px]"></div>
          } @else {
            <div class="absolute -top-16 -right-8 h-44 w-44 rounded-full bg-indigo-400/20 blur-[55px]"></div>
            <div class="absolute -bottom-12 -left-8 h-36 w-36 rounded-full bg-cyan-400/18 blur-[50px]"></div>
            <div class="absolute top-1/2 right-0 h-28 w-28 rounded-full bg-amber-300/15 blur-[45px]"></div>
          }
        </div>

        <!-- Brand header -->
        <div class="sidebar-header relative z-10 border-b px-3 py-3.5">
          @if (sidebarCollapsed()) {
            <!-- Collapsed: icon logo + expand toggle -->
            <div class="flex flex-col items-center gap-2">
              <app-brand-logo [size]="34" [decorative]="true" />
              <button
                type="button"
                (click)="toggleSidebar()"
                aria-label="Expand sidebar"
                class="sidebar-icon-btn rounded-lg p-1.5 transition-colors"
              >
                <svg class="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.7"
                    d="M20 5v14M9 8l5 4-5 4M4 8l5 4-5 4"/>
                </svg>
              </button>
            </div>
          } @else {
            <!-- Expanded: compact wordmark + collapse toggle -->
            <div class="flex items-center justify-between gap-2">
              <img
                [src]="wordmarkSrc"
                alt="WorkDesk AI"
                class="h-12 min-w-0 flex-1 object-contain"
                decoding="async"
              />
              <button
                type="button"
                (click)="toggleSidebar()"
                aria-label="Collapse sidebar"
                class="sidebar-icon-btn flex-shrink-0 rounded-lg p-1.5 transition-colors"
              >
                <svg class="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.7"
                    d="M4 5v14M15 8l-5 4 5 4M20 8l-5 4 5 4"/>
                </svg>
              </button>
            </div>

            <!-- Search -->
            <div class="mt-3.5">
              <label for="navSearch" class="sr-only">Search tools</label>
              <div class="relative">
                <svg class="sidebar-search-icon pointer-events-none absolute left-3 top-1/2 h-[14px] w-[14px] -translate-y-1/2"
                  viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M21 21l-4.2-4.2m1-5.3a6.3 6.3 0 11-12.6 0 6.3 6.3 0 0112.6 0z" />
                </svg>
                <input
                  id="navSearch"
                  type="text"
                  [value]="commandQuery()"
                  (input)="updateQuery($any($event.target).value)"
                  placeholder="Search tools…"
                  class="sidebar-search w-full rounded-xl border py-2 pl-9 pr-3 text-[13px] outline-none transition focus:ring-0"
                />
              </div>
            </div>
          }
        </div>

        <!-- Nav -->
        <nav class="relative z-10 flex-1 space-y-3.5 overflow-y-auto px-2.5 py-4" aria-label="Tools">

          <!-- ── Recent: collapsed mode trigger (top of nav) ── -->
          @if (sidebarCollapsed()) {
            <div class="mb-0.5">
              <button
                type="button"
                class="group mb-0.5 flex w-full items-center justify-center rounded-xl px-2 py-[9px] transition-all duration-150"
                [class.active-nav-item]="historyPopupOpen()"
                [class.inactive-nav-item]="!historyPopupOpen()"
                title="Recent"
                aria-label="Recent activity"
                (click)="toggleHistoryPopup()"
              >
                <span
                  class="nav-icon flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-lg transition-all duration-150"
                  [class.active-nav-icon]="historyPopupOpen()"
                  [class.inactive-nav-icon]="!historyPopupOpen()"
                >
                  <svg class="h-[15px] w-[15px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75"
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                </span>
              </button>
              <div class="sidebar-nav-divider mx-1 border-t"></div>
            </div>
          }

          <!-- ── Recent: expanded mode inline section ── -->
          @if (!sidebarCollapsed() && recentItems().length > 0) {
            <div>
              <div class="mb-1.5 flex items-center justify-between px-2.5">
                <p class="sidebar-section-label text-[10px] font-semibold uppercase tracking-[0.14em]">Recent</p>
                <button
                  type="button"
                  class="sidebar-icon-btn rounded p-0.5 transition-colors"
                  (click)="toggleRecentSection()"
                  [attr.aria-expanded]="recentExpanded()"
                  aria-label="Toggle recent section"
                >
                  <svg
                    class="h-3 w-3 transition-transform duration-200"
                    [class.-rotate-90]="!recentExpanded()"
                    fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                  </svg>
                </button>
              </div>

              @if (recentExpanded()) {
                @for (h of recentItems(); track h.id) {
                  <button
                    type="button"
                    class="recent-nav-item group mb-0.5 flex w-full items-center gap-2.5 rounded-xl px-2.5 py-[9px] text-left transition-all duration-150"
                    (click)="openHistory(h)"
                  >
                    <span
                      class="nav-icon inactive-nav-icon flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-lg transition-all duration-150"
                      [attr.data-icon]="historyIcon(h.taskType)"
                    >
                      <svg class="h-[15px] w-[15px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" [attr.d]="iconPath(historyIcon(h.taskType))"/>
                      </svg>
                    </span>
                    <span class="min-w-0 flex-1">
                      <span class="block truncate text-[13px] font-medium">{{ h.inputSummary || 'Untitled' }}</span>
                      <span class="recent-sub block truncate text-[10px]">{{ historyLabel(h.taskType) }} · {{ formatHistoryDate(h.timestamp) }}</span>
                    </span>
                  </button>
                }
                <div class="flex items-center justify-end px-2.5 pb-0.5 pt-1">
                  <button
                    type="button"
                    class="sidebar-recent-clear text-[10px] transition-colors"
                    (click)="clearHistory()"
                  >
                    Clear recent
                  </button>
                </div>
              }
            </div>
          }

          <!-- Loading / empty states -->
          @if (navLoading()) {
            <p class="sidebar-empty-text px-2.5 py-10 text-center text-xs">Loading tools…</p>
          } @else if (!navGroups().length) {
            <div class="px-2.5 py-10 text-center">
              <svg class="sidebar-empty-icon mx-auto mb-2 h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                  d="M21 21l-4.2-4.2m1-5.3a6.3 6.3 0 11-12.6 0 6.3 6.3 0 0112.6 0z" />
              </svg>
              <p class="sidebar-empty-text text-xs">No tools available.</p>
            </div>
          }

          <!-- Tool sections -->
          @for (group of navGroups(); track group.section) {
            <div>
              @if (!sidebarCollapsed()) {
                <p class="sidebar-section-label mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.14em]">
                  {{ group.section }}
                </p>
              }
              @for (item of group.items; track item.path) {
                <a
                  [routerLink]="item.path"
                  #rla="routerLinkActive"
                  routerLinkActive
                  [routerLinkActiveOptions]="{ exact: false }"
                  class="group mb-0.5 flex items-center gap-2.5 rounded-xl px-2.5 py-[9px] text-[13px]
                         transition-all duration-150"
                  [class.active-nav-item]="rla.isActive"
                  [class.inactive-nav-item]="!rla.isActive"
                  [class.justify-center]="sidebarCollapsed()"
                  [class.px-2]="sidebarCollapsed()"
                  [attr.title]="sidebarCollapsed() ? item.label : null"
                >
                  <span
                    class="nav-icon flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-lg transition-all duration-150"
                    [attr.data-icon]="item.icon"
                    [class.active-nav-icon]="rla.isActive"
                    [class.inactive-nav-icon]="!rla.isActive"
                  >
                    <svg class="h-[15px] w-[15px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" [attr.d]="iconPath(item.icon)" />
                    </svg>
                  </span>
                  @if (!sidebarCollapsed()) {
                    <span class="truncate flex-1">{{ item.label }}</span>
                    <button
                      type="button"
                      class="sidebar-icon-btn ml-1 rounded p-0.5 text-[11px] opacity-60 hover:opacity-100"
                      [attr.aria-label]="isFavorite(item.task_type) ? 'Unpin' : 'Pin tool'"
                      (click)="toggleFavorite($event, item.task_type)"
                    >
                      {{ isFavorite(item.task_type) ? '★' : '☆' }}
                    </button>
                  }
                </a>
              }
            </div>
          }
        </nav>

        <!-- Footer -->
        <div class="sidebar-footer relative z-10 border-t px-3.5 py-3">
          @if (!sidebarCollapsed()) {
            <div class="mb-2.5">
              <a routerLink="/feedback" class="sidebar-feedback-btn flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-semibold transition-colors">
                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75"
                    d="M5.5 5h13A2.5 2.5 0 0121 7.5v7A2.5 2.5 0 0118.5 17H9l-4.5 3v-3H5.5A2.5 2.5 0 013 14.5v-7A2.5 2.5 0 015.5 5z"/>
                </svg>
                Send feedback
              </a>
            </div>
            <div class="flex items-center justify-between gap-2">
              <div class="min-w-0">
                <p class="sidebar-footer-title truncate text-[11.5px] font-medium">Adit Microsys Pvt. Ltd.</p>
                <p class="sidebar-footer-sub truncate text-[10px]">Private · Internal use only</p>
              </div>
              <div class="flex flex-shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  (click)="theme.toggle()"
                  [attr.aria-label]="theme.mode() === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
                  class="sidebar-icon-btn rounded-lg p-1.5 transition-colors"
                  title="Toggle theme"
                >
                  @if (theme.mode() === 'dark') {
                    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75"
                        d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/>
                    </svg>
                  } @else {
                    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75"
                        d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>
                    </svg>
                  }
                </button>
                <span class="sidebar-version-badge rounded-full border px-2 py-0.5 text-[10px]">v1.1</span>
              </div>
            </div>
          } @else {
            <div class="flex flex-col items-center gap-2">
              <a
                routerLink="/feedback"
                aria-label="Send feedback"
                class="sidebar-feedback-icon rounded-lg p-1.5 transition-colors"
                title="Send feedback"
              >
                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75"
                    d="M5.5 5h13A2.5 2.5 0 0121 7.5v7A2.5 2.5 0 0118.5 17H9l-4.5 3v-3H5.5A2.5 2.5 0 013 14.5v-7A2.5 2.5 0 015.5 5z"/>
                </svg>
              </a>
              <button
                type="button"
                (click)="theme.toggle()"
                [attr.aria-label]="theme.mode() === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
                class="sidebar-icon-btn rounded-lg p-1.5 transition-colors"
                title="Toggle theme"
              >
                @if (theme.mode() === 'dark') {
                  <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75"
                      d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/>
                  </svg>
                } @else {
                  <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75"
                      d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>
                  </svg>
                }
              </button>
            </div>
          }
        </div>
      </aside>

      <!-- ── Recent popup (collapsed mode only) ─────────────── -->
      @if (historyPopupOpen() && sidebarCollapsed()) {
        <div
          class="history-backdrop fixed inset-0 z-[60]"
          (click)="closeHistoryPopup()"
          aria-hidden="true"
        ></div>
        <div
          class="history-popup fixed z-[61] flex max-h-[min(420px,70vh)] w-[min(300px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border shadow-2xl"
          [style.top.px]="90"
          [style.left.rem]="5.5"
          role="dialog"
          aria-label="Recent activity"
          (click)="$event.stopPropagation()"
        >
          <div class="history-popup-header flex items-center justify-between gap-2 border-b px-4 py-3">
            <div>
              <h2 class="text-sm font-semibold">Recent</h2>
              <p class="text-[11px] opacity-70">Saved only in this browser</p>
            </div>
            <button
              type="button"
              class="history-popup-close rounded-lg p-1 transition-colors"
              aria-label="Close"
              (click)="closeHistoryPopup()"
            >
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
          <ul class="flex-1 space-y-1 overflow-y-auto px-2 py-2">
            @for (h of historyEntries(); track h.id) {
              <li>
                <button
                  type="button"
                  class="history-popup-item w-full rounded-xl px-3 py-2.5 text-left text-[12px] transition-colors"
                  (click)="openHistory(h)"
                >
                  <span class="block truncate font-medium">{{ h.inputSummary || 'Untitled' }}</span>
                  <span class="mt-0.5 block truncate text-[11px] opacity-65">
                    {{ historyLabel(h.taskType) }} · {{ formatHistoryDate(h.timestamp) }}
                  </span>
                </button>
              </li>
            } @empty {
              <li class="px-3 py-8 text-center text-[12px] opacity-60">No history yet.</li>
            }
          </ul>
          @if (historyEntries().length) {
            <div class="border-t px-3 py-2">
              <button
                type="button"
                class="history-popup-clear w-full rounded-lg px-2 py-1.5 text-left text-[11px] transition-colors"
                (click)="clearHistory()"
              >
                Clear history
              </button>
            </div>
          }
        </div>
      }

      <!-- ── Main content ────────────────────────────────────── -->
      <main class="relative z-10 flex min-w-0 flex-1 flex-col">
        <div class="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          <router-outlet />
        </div>
      </main>
    </div>
  `,
  styles: [`
    :host {
      display: contents;
    }

    /* ── Dark sidebar shell ───────────────────────────── */
    .sidebar-dark {
      border: 1px solid rgba(255, 255, 255, 0.07);
      box-shadow: 0 8px 40px rgba(0, 0, 0, 0.45);
    }
    .sidebar-dark .sidebar-header,
    .sidebar-dark .sidebar-footer {
      border-color: rgba(255, 255, 255, 0.07);
    }
    .sidebar-dark .sidebar-icon-btn {
      color: rgba(255, 255, 255, 0.4);
    }
    .sidebar-dark .sidebar-icon-btn:hover {
      background: rgba(255, 255, 255, 0.08);
      color: rgba(255, 255, 255, 0.8);
    }
    .sidebar-dark .sidebar-search {
      border-color: rgba(255, 255, 255, 0.08);
      background: rgba(255, 255, 255, 0.05);
      color: rgba(255, 255, 255, 0.8);
    }
    .sidebar-dark .sidebar-search::placeholder {
      color: rgba(255, 255, 255, 0.25);
    }
    .sidebar-dark .sidebar-search:focus {
      border-color: rgba(129, 140, 248, 0.5);
      background: rgba(255, 255, 255, 0.08);
    }
    .sidebar-dark .sidebar-search-icon {
      color: rgba(255, 255, 255, 0.3);
    }
    .sidebar-dark .sidebar-section-label {
      color: rgba(255, 255, 255, 0.3);
    }
    .sidebar-dark .sidebar-empty-icon {
      color: rgba(255, 255, 255, 0.2);
    }
    .sidebar-dark .sidebar-empty-text {
      color: rgba(255, 255, 255, 0.25);
    }
    .sidebar-dark .sidebar-footer-title {
      color: rgba(255, 255, 255, 0.6);
    }
    .sidebar-dark .sidebar-footer-sub {
      color: rgba(255, 255, 255, 0.25);
    }
    .sidebar-dark .sidebar-version-badge {
      border-color: rgba(255, 255, 255, 0.1);
      background: rgba(255, 255, 255, 0.06);
      color: rgba(255, 255, 255, 0.3);
    }
    .sidebar-dark .active-nav-item {
      background: rgba(129, 140, 248, 0.15);
      color: #fff;
      box-shadow: 0 2px 12px rgba(99, 102, 241, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.06);
    }
    .sidebar-dark .inactive-nav-item {
      color: rgba(255, 255, 255, 0.5);
    }
    .sidebar-dark .inactive-nav-item:hover {
      background: rgba(255, 255, 255, 0.05);
      color: rgba(255, 255, 255, 0.85);
    }
    .sidebar-dark .active-nav-icon {
      background: rgba(129, 140, 248, 0.25);
      border: 1px solid rgba(129, 140, 248, 0.35);
      color: #a5b4fc;
    }
    .sidebar-dark .inactive-nav-icon {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.07);
      color: rgba(255, 255, 255, 0.35);
    }
    .sidebar-dark .inactive-nav-item:hover .inactive-nav-icon {
      background: rgba(255, 255, 255, 0.08);
      border-color: rgba(255, 255, 255, 0.14);
      color: rgba(255, 255, 255, 0.75);
    }

    /* ── Light sidebar shell (soft, not stark white) ─── */
    .sidebar-light {
      border: 1px solid rgba(99, 102, 241, 0.14);
      box-shadow:
        0 10px 36px rgba(79, 70, 229, 0.1),
        0 2px 8px rgba(15, 23, 42, 0.04),
        inset 0 1px 0 rgba(255, 255, 255, 0.65);
    }
    .sidebar-light .sidebar-header,
    .sidebar-light .sidebar-footer {
      border-color: rgba(99, 102, 241, 0.12);
    }
    .sidebar-light .sidebar-icon-btn {
      color: #64748b;
    }
    .sidebar-light .sidebar-icon-btn:hover {
      background: rgba(99, 102, 241, 0.1);
      color: #4338ca;
    }
    .sidebar-light .sidebar-search {
      border-color: rgba(99, 102, 241, 0.16);
      background: rgba(255, 255, 255, 0.55);
      color: #1e293b;
    }
    .sidebar-light .sidebar-search::placeholder {
      color: #94a3b8;
    }
    .sidebar-light .sidebar-search:focus {
      border-color: rgba(99, 102, 241, 0.45);
      background: rgba(255, 255, 255, 0.72);
    }
    .sidebar-light .sidebar-search-icon {
      color: #94a3b8;
    }
    .sidebar-light .sidebar-section-label {
      color: #6366f1;
    }
    .sidebar-light .sidebar-empty-icon {
      color: #cbd5e1;
    }
    .sidebar-light .sidebar-empty-text {
      color: #94a3b8;
    }
    .sidebar-light .sidebar-footer-title {
      color: #334155;
    }
    .sidebar-light .sidebar-footer-sub {
      color: #94a3b8;
    }
    .sidebar-light .sidebar-version-badge {
      border-color: rgba(99, 102, 241, 0.2);
      background: rgba(99, 102, 241, 0.08);
      color: #6366f1;
    }
    .sidebar-light .active-nav-item {
      background: linear-gradient(135deg, rgba(99, 102, 241, 0.14), rgba(14, 165, 233, 0.1));
      color: #312e81;
      box-shadow: 0 2px 10px rgba(99, 102, 241, 0.12);
    }
    .sidebar-light .inactive-nav-item {
      color: #475569;
    }
    .sidebar-light .inactive-nav-item:hover {
      background: rgba(99, 102, 241, 0.07);
      color: #1e1b4b;
    }
    .sidebar-light .active-nav-icon {
      background: rgba(99, 102, 241, 0.18);
      border: 1px solid rgba(99, 102, 241, 0.35);
      color: #4f46e5;
    }
    .sidebar-light .inactive-nav-icon {
      border: 1px solid transparent;
    }
    .sidebar-light .inactive-nav-icon[data-icon="mail"] {
      background: rgba(14, 165, 233, 0.12);
      border-color: rgba(14, 165, 233, 0.28);
      color: #0284c7;
    }
    .sidebar-light .inactive-nav-icon[data-icon="chat"] {
      background: rgba(139, 92, 246, 0.12);
      border-color: rgba(139, 92, 246, 0.28);
      color: #7c3aed;
    }
    .sidebar-light .inactive-nav-icon[data-icon="document"] {
      background: rgba(16, 185, 129, 0.12);
      border-color: rgba(16, 185, 129, 0.28);
      color: #059669;
    }
    .sidebar-light .inactive-nav-icon[data-icon="sparkles"] {
      background: rgba(245, 158, 11, 0.14);
      border-color: rgba(245, 158, 11, 0.3);
      color: #d97706;
    }
    .sidebar-light .inactive-nav-icon[data-icon="language"] {
      background: rgba(6, 182, 212, 0.12);
      border-color: rgba(6, 182, 212, 0.28);
      color: #0891b2;
    }
    .sidebar-light .inactive-nav-icon[data-icon="chart"] {
      background: rgba(99, 102, 241, 0.12);
      border-color: rgba(99, 102, 241, 0.28);
      color: #4f46e5;
    }
    .sidebar-light .inactive-nav-icon[data-icon="shield"] {
      background: rgba(244, 63, 94, 0.1);
      border-color: rgba(244, 63, 94, 0.26);
      color: #e11d48;
    }
    .sidebar-light .inactive-nav-icon[data-icon="code"] {
      background: rgba(59, 130, 246, 0.12);
      border-color: rgba(59, 130, 246, 0.28);
      color: #2563eb;
    }
    .sidebar-light .inactive-nav-icon[data-icon="commit"] {
      background: rgba(20, 184, 166, 0.12);
      border-color: rgba(20, 184, 166, 0.28);
      color: #0d9488;
    }
    .sidebar-light .inactive-nav-icon[data-icon="bug"] {
      background: rgba(249, 115, 22, 0.12);
      border-color: rgba(249, 115, 22, 0.28);
      color: #ea580c;
    }
    .sidebar-light .inactive-nav-icon[data-icon="check"] {
      background: rgba(34, 197, 94, 0.12);
      border-color: rgba(34, 197, 94, 0.28);
      color: #16a34a;
    }
    .sidebar-light .inactive-nav-icon[data-icon="wand"] {
      background: rgba(168, 85, 247, 0.12);
      border-color: rgba(168, 85, 247, 0.28);
      color: #9333ea;
    }
    .sidebar-light .inactive-nav-item:hover .inactive-nav-icon {
      filter: saturate(1.15);
      transform: scale(1.03);
    }

    /* ── Nav divider (between Recent and tools, collapsed) ─ */
    .sidebar-dark .sidebar-nav-divider {
      border-color: rgba(255, 255, 255, 0.07);
    }
    .sidebar-light .sidebar-nav-divider {
      border-color: rgba(99, 102, 241, 0.12);
    }

    /* ── Recent inline items (expanded) ──────────────────── */
    .sidebar-dark .recent-nav-item {
      color: rgba(255, 255, 255, 0.5);
    }
    .sidebar-dark .recent-nav-item:hover {
      background: rgba(255, 255, 255, 0.05);
      color: rgba(255, 255, 255, 0.85);
    }
    .sidebar-dark .recent-nav-item:hover .inactive-nav-icon {
      background: rgba(255, 255, 255, 0.08);
      border-color: rgba(255, 255, 255, 0.14);
      color: rgba(255, 255, 255, 0.75);
    }
    .sidebar-dark .recent-sub {
      color: rgba(255, 255, 255, 0.32);
    }
    .sidebar-dark .sidebar-recent-clear {
      color: rgba(255, 255, 255, 0.28);
    }
    .sidebar-dark .sidebar-recent-clear:hover {
      color: rgba(255, 255, 255, 0.6);
    }

    .sidebar-light .recent-nav-item {
      color: #475569;
    }
    .sidebar-light .recent-nav-item:hover {
      background: rgba(99, 102, 241, 0.07);
      color: #1e1b4b;
    }
    .sidebar-light .recent-nav-item:hover .inactive-nav-icon {
      filter: saturate(1.15);
      transform: scale(1.03);
    }
    .sidebar-light .recent-sub {
      color: #94a3b8;
    }
    .sidebar-light .sidebar-recent-clear {
      color: #94a3b8;
    }
    .sidebar-light .sidebar-recent-clear:hover {
      color: #475569;
    }

    /* ── Feedback button (footer) ─────────────────────── */
    .sidebar-dark .sidebar-feedback-btn {
      background: linear-gradient(135deg, rgba(99, 102, 241, 0.9), rgba(79, 70, 229, 0.95));
      color: #fff;
      box-shadow: 0 4px 14px rgba(99, 102, 241, 0.35);
    }
    .sidebar-dark .sidebar-feedback-btn:hover {
      background: linear-gradient(135deg, #818cf8, #6366f1);
      box-shadow: 0 6px 18px rgba(99, 102, 241, 0.45);
    }
    .sidebar-dark .sidebar-feedback-icon {
      color: #c7d2fe;
      background: rgba(129, 140, 248, 0.2);
      border: 1px solid rgba(129, 140, 248, 0.35);
    }
    .sidebar-dark .sidebar-feedback-icon:hover {
      background: rgba(129, 140, 248, 0.32);
      color: #fff;
    }

    .sidebar-light .sidebar-feedback-btn {
      background: linear-gradient(135deg, #6366f1, #4f46e5);
      color: #fff;
      box-shadow: 0 4px 14px rgba(79, 70, 229, 0.28);
    }
    .sidebar-light .sidebar-feedback-btn:hover {
      background: linear-gradient(135deg, #4f46e5, #4338ca);
      box-shadow: 0 6px 18px rgba(79, 70, 229, 0.36);
    }
    .sidebar-light .sidebar-feedback-icon {
      color: #4f46e5;
      background: rgba(99, 102, 241, 0.14);
      border: 1px solid rgba(99, 102, 241, 0.28);
    }
    .sidebar-light .sidebar-feedback-icon:hover {
      background: rgba(99, 102, 241, 0.22);
      color: #312e81;
    }

    /* ── Recent popup ─────────────────────────────────── */
    .history-backdrop {
      background: rgba(15, 23, 42, 0.35);
    }
    html.dark .history-backdrop {
      background: rgba(0, 0, 0, 0.5);
    }
    .history-popup {
      border-color: rgb(var(--c-stroke) / 0.85);
      background: rgb(var(--c-surface-raised) / 0.98);
      backdrop-filter: blur(12px);
      color: rgb(var(--c-content));
    }
    .history-popup-header {
      border-color: rgb(var(--c-stroke) / 0.65);
    }
    .history-popup-close {
      color: rgb(var(--c-muted));
    }
    .history-popup-close:hover {
      background: rgb(var(--c-stroke) / 0.35);
      color: rgb(var(--c-content));
    }
    .history-popup-item:hover {
      background: rgb(var(--c-accent) / 0.1);
    }
    .history-popup-clear {
      color: rgb(var(--c-muted));
    }
    .history-popup-clear:hover {
      background: rgb(var(--c-stroke) / 0.25);
      color: rgb(var(--c-content));
    }
  `],
})
export default class ShellComponent implements OnInit {
  theme = inject(ThemeService);
  private router = inject(Router);
  private tasksSvc = inject(TasksService);
  private historySvc = inject(HistoryService);
  private historyRestore = inject(HistoryRestoreService);

  sidebarCollapsed = signal(false);
  commandQuery = signal('');
  navLoading = signal(true);
  historyPopupOpen = signal(false);
  favoritesVersion = signal(0);
  recentExpanded = signal(true);

  historyEntries = this.historySvc.entries;

  recentItems = computed(() => this.historyEntries().slice(0, 4));

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.historyPopupOpen()) {
      this.closeHistoryPopup();
    }
  }

  ngOnInit(): void {
    this.tasksSvc.load().subscribe({
      next: () => this.navLoading.set(false),
      error: () => this.navLoading.set(false),
    });
  }

  private currentUrl = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(() => this.router.url),
      startWith(this.router.url),
    ),
  );

  activeTool = computed(() => {
    const url = this.currentUrl() ?? '';
    const task = this.tasksSvc.taskForPath(url);
    if (task) {
      return {
        path: task.path,
        label: task.display_name,
        icon: task.icon,
        description: task.description,
      };
    }
    return { path: '/', label: 'WorkDesk AI', icon: 'wand', description: '' };
  });

  navGroups = computed(() => {
    this.favoritesVersion();
    const query = this.commandQuery().trim().toLowerCase();
    const groups = this.tasksSvc.navGroups(this.historySvc.getFavorites());
    if (!query) return groups;
    return groups
      .map(group => ({
        ...group,
        items: group.items.filter(item => item.label.toLowerCase().includes(query)),
      }))
      .filter(group => group.items.length > 0);
  });

  isFavorite(taskType: string): boolean {
    return this.historySvc.isFavorite(taskType);
  }

  toggleFavorite(event: Event, taskType: string): void {
    event.preventDefault();
    event.stopPropagation();
    this.historySvc.toggleFavorite(taskType);
    this.favoritesVersion.update((v) => v + 1);
  }

  openHistory(entry: HistoryEntry): void {
    const task = this.tasksSvc.tasks().find((t) => t.task_type === entry.taskType);
    if (task) {
      this.historyRestore.request(entry);
      this.closeHistoryPopup();
      this.router.navigate([task.path]);
    }
  }

  clearHistory(): void {
    this.historySvc.clearAll();
  }

  toggleHistoryPopup(): void {
    this.historyPopupOpen.update((v) => !v);
  }

  closeHistoryPopup(): void {
    this.historyPopupOpen.set(false);
  }

  toggleRecentSection(): void {
    this.recentExpanded.update((v) => !v);
  }

  historyIcon(taskType: string): string {
    return this.tasksSvc.tasks().find((t) => t.task_type === taskType)?.icon ?? 'document';
  }

  formatHistoryDate(ts: number): string {
    return new Date(ts).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  historyLabel(taskType: string): string {
    return this.tasksSvc.tasks().find((t) => t.task_type === taskType)?.display_name ?? taskType;
  }

  get wordmarkSrc(): string {
    return this.theme.mode() === 'dark'
      ? 'workdesk-ai-wordmark.svg'
      : 'workdesk-ai-wordmark-light.svg';
  }

  get sidebarBg(): string {
    if (this.theme.mode() === 'dark') {
      return 'linear-gradient(160deg, #0f1729 0%, #0d1424 55%, #0a1020 100%)';
    }
    return 'linear-gradient(155deg, #e8edf7 0%, #e2e9f4 42%, #dde6f2 100%)';
  }

  toggleSidebar(): void {
    this.sidebarCollapsed.update(v => !v);
    this.closeHistoryPopup();
  }

  updateQuery(value: string): void {
    this.commandQuery.set(value);
  }

  iconPath(icon: string): string {
    return toolIconPath(icon);
  }
}

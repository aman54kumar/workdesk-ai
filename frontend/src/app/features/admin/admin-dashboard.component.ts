import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AdminService, AdminTask, AllowedModels } from '../../core/services/admin.service';
import { BrandLogoComponent } from '../../shared/components/brand-logo/brand-logo.component';

interface TaskDraft {
  task_type: string;
  display_name: string;
  description: string;
  section: string;
  default_model: string;
  is_active: boolean;
  model_override: string;
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [FormsModule, RouterLink, BrandLogoComponent],
  template: `
    <div class="min-h-screen bg-canvas px-4 py-8 text-content">
      <div class="mx-auto max-w-5xl">
        <header class="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <app-brand-logo [size]="36" [decorative]="true" />
            <div>
              <h1 class="text-2xl font-semibold leading-tight">Admin</h1>
              <p class="text-sm text-muted">Tools visibility and per-task models</p>
            </div>
          </div>
          <div class="flex shrink-0 items-center gap-2">
            <a routerLink="/" class="btn-secondary text-sm">Open app</a>
            <button type="button" class="btn-secondary text-sm" (click)="logout()">Sign out</button>
          </div>
        </header>

        @if (loadError()) {
          <p class="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            {{ loadError() }}
          </p>
        } @else if (loading()) {
          <p class="text-sm text-muted">Loading…</p>
        } @else {
          <div
            class="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stroke
                   bg-surface px-4 py-3"
          >
            <p class="text-sm text-muted">
              @if (hasChanges()) {
                You have unsaved changes.
              } @else {
                All changes saved.
              }
            </p>
            <div class="flex items-center gap-2">
              @if (saveMessage()) {
                <span class="text-sm text-muted">{{ saveMessage() }}</span>
              }
              <button
                type="button"
                class="btn-secondary text-sm"
                [disabled]="!hasChanges() || saving()"
                (click)="discard()"
              >
                Discard
              </button>
              <button
                type="button"
                class="btn-primary text-sm"
                [disabled]="!hasChanges() || saving()"
                (click)="saveAll()"
              >
                {{ saving() ? 'Saving…' : 'Save changes' }}
              </button>
            </div>
          </div>

          <div class="overflow-hidden rounded-2xl border border-stroke bg-surface">
            <table class="w-full table-fixed text-left text-sm">
              <colgroup>
                <col class="w-[34%]" />
                <col class="w-[18%]" />
                <col class="w-[14%]" />
                <col class="w-[34%]" />
              </colgroup>
              <thead class="border-b border-stroke bg-surface-raised text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th class="px-5 py-3.5 align-middle font-semibold">Tool</th>
                  <th class="px-5 py-3.5 align-middle font-semibold">Section</th>
                  <th class="px-5 py-3.5 align-middle text-center font-semibold">Active</th>
                  <th class="px-5 py-3.5 align-middle font-semibold">Model</th>
                </tr>
              </thead>
              <tbody>
                @for (task of draftTasks(); track task.task_type) {
                  <tr
                    class="border-b border-stroke last:border-0"
                    [class.admin-row-changed]="isRowChanged(task.task_type)"
                  >
                    <td class="px-5 py-4 align-middle">
                      <p class="font-medium leading-snug">{{ task.display_name }}</p>
                      <p class="mt-0.5 truncate text-xs text-faint">{{ task.task_type }}</p>
                    </td>
                    <td class="px-5 py-4 align-middle text-muted">{{ task.section }}</td>
                    <td class="px-5 py-4 align-middle">
                      <div class="flex items-center justify-center">
                        <label class="inline-flex cursor-pointer items-center gap-2">
                          <input
                            type="checkbox"
                            class="h-4 w-4 rounded border-stroke accent-accent"
                            [checked]="task.is_active"
                            [disabled]="saving()"
                            (change)="setActive(task.task_type, $any($event.target).checked)"
                          />
                          <span class="w-7 text-center text-xs text-muted">
                            {{ task.is_active ? 'On' : 'Off' }}
                          </span>
                        </label>
                      </div>
                    </td>
                    <td class="px-5 py-4 align-middle">
                      <select
                        class="field-input w-full max-w-full text-sm"
                        [disabled]="saving()"
                        [ngModel]="task.model_override"
                        (ngModelChange)="setModel(task.task_type, $event)"
                      >
                        <option value="">Default ({{ task.default_model }})</option>
                        @for (m of allowedModels(); track m) {
                          <option [value]="m">{{ m }}</option>
                        }
                      </select>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .admin-row-changed {
      background-color: rgb(var(--c-accent) / 0.08);
    }
  `],
})
export default class AdminDashboardComponent implements OnInit {
  private admin = inject(AdminService);
  private router = inject(Router);

  private savedTasks = signal<AdminTask[]>([]);
  draftTasks = signal<TaskDraft[]>([]);
  allowedModels = signal<string[]>([]);
  loading = signal(true);
  loadError = signal('');
  saving = signal(false);
  saveMessage = signal('');

  hasChanges = computed(() => this.changedTaskTypes().length > 0);

  private changedTaskTypes = computed(() => {
    const saved = new Map(this.savedTasks().map((t) => [t.task_type, t]));
    return this.draftTasks()
      .filter((d) => {
        const s = saved.get(d.task_type);
        if (!s) return false;
        const savedModel = s.model_override ?? '';
        return d.is_active !== s.is_active || d.model_override !== savedModel;
      })
      .map((d) => d.task_type);
  });

  ngOnInit(): void {
    this.admin.getModels().subscribe({
      next: (res: AllowedModels) => this.allowedModels.set(res.models),
      error: () => this.allowedModels.set([]),
    });
    this.reloadTasks();
  }

  isRowChanged(taskType: string): boolean {
    return this.changedTaskTypes().includes(taskType);
  }

  setActive(taskType: string, isActive: boolean): void {
    this.draftTasks.update((list) =>
      list.map((t) => (t.task_type === taskType ? { ...t, is_active: isActive } : t)),
    );
    this.saveMessage.set('');
  }

  setModel(taskType: string, value: string): void {
    this.draftTasks.update((list) =>
      list.map((t) => (t.task_type === taskType ? { ...t, model_override: value } : t)),
    );
    this.saveMessage.set('');
  }

  discard(): void {
    this.applySavedToDraft(this.savedTasks());
    this.saveMessage.set('');
    this.loadError.set('');
  }

  saveAll(): void {
    const changed = this.changedTaskTypes();
    if (!changed.length) return;

    this.saving.set(true);
    this.loadError.set('');
    this.saveMessage.set('');

    const requests = changed.map((taskType) => {
      const draft = this.draftTasks().find((t) => t.task_type === taskType)!;
      return this.admin.updateTask(taskType, {
        is_active: draft.is_active,
        model_override: draft.model_override || null,
      });
    });

    forkJoin(requests).subscribe({
      next: (updatedList) => {
        const byType = new Map(updatedList.map((t) => [t.task_type, t]));
        this.savedTasks.update((list) =>
          list.map((t) => byType.get(t.task_type) ?? t),
        );
        this.applySavedToDraft(this.savedTasks());
        this.saving.set(false);
        this.saveMessage.set('Changes saved.');
      },
      error: (err) => {
        this.saving.set(false);
        if (err.status === 401) {
          this.admin.logout();
          this.router.navigate(['/admin/login']);
          return;
        }
        this.loadError.set('Failed to save changes. Please try again.');
      },
    });
  }

  logout(): void {
    this.admin.logout();
    this.router.navigate(['/admin/login']);
  }

  private reloadTasks(): void {
    this.admin.getTasks().subscribe({
      next: (tasks) => {
        this.savedTasks.set(tasks);
        this.applySavedToDraft(tasks);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        if (err.status === 401) {
          this.admin.logout();
          this.router.navigate(['/admin/login']);
          return;
        }
        this.loadError.set('Could not load tasks. Is the backend running?');
      },
    });
  }

  private applySavedToDraft(tasks: AdminTask[]): void {
    this.draftTasks.set(
      tasks.map((t) => ({
        task_type: t.task_type,
        display_name: t.display_name,
        description: t.description,
        section: t.section,
        default_model: t.default_model,
        is_active: t.is_active,
        model_override: t.model_override ?? '',
      })),
    );
  }
}

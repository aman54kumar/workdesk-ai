import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AdminService, AdminTask, AllowedModels } from '../../core/services/admin.service';

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
  selector: 'app-admin-tools',
  standalone: true,
  imports: [FormsModule],
  template: `
    @if (loadError()) {
      <p class="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{{ loadError() }}</p>
    } @else if (loading()) {
      <p class="text-sm text-muted">Loading…</p>
    } @else {
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stroke bg-surface px-4 py-3">
        <p class="text-sm text-muted">{{ hasChanges() ? 'You have unsaved changes.' : 'All changes saved.' }}</p>
        <div class="flex items-center gap-2">
          @if (saveMessage()) { <span class="text-sm text-muted">{{ saveMessage() }}</span> }
          <button type="button" class="btn-secondary text-sm" [disabled]="!hasChanges() || saving()" (click)="discard()">Discard</button>
          <button type="button" class="btn-primary text-sm" [disabled]="!hasChanges() || saving()" (click)="saveAll()">
            {{ saving() ? 'Saving…' : 'Save changes' }}
          </button>
        </div>
      </div>
      <div class="overflow-hidden rounded-2xl border border-stroke bg-surface">
        <table class="w-full table-fixed text-left text-sm">
          <thead class="border-b border-stroke bg-surface-raised text-xs uppercase tracking-wide text-muted">
            <tr>
              <th class="px-5 py-3.5">Tool</th>
              <th class="px-5 py-3.5">Section</th>
              <th class="px-5 py-3.5 text-center">Active</th>
              <th class="px-5 py-3.5">Model</th>
            </tr>
          </thead>
          <tbody>
            @for (task of draftTasks(); track task.task_type) {
              <tr class="border-b border-stroke last:border-0" [class.admin-row-changed]="isRowChanged(task.task_type)">
                <td class="px-5 py-4">
                  <p class="font-medium">{{ task.display_name }}</p>
                  <p class="text-xs text-faint">{{ task.task_type }}</p>
                </td>
                <td class="px-5 py-4 text-muted">{{ task.section }}</td>
                <td class="px-5 py-4 text-center">
                  <input type="checkbox" [checked]="task.is_active" (change)="setActive(task.task_type, $any($event.target).checked)" />
                </td>
                <td class="px-5 py-4">
                  <select class="field-input w-full text-sm" [ngModel]="task.model_override" (ngModelChange)="setModel(task.task_type, $event)">
                    <option value="">Default ({{ task.default_model }})</option>
                    @for (m of allowedModels(); track m) { <option [value]="m">{{ m }}</option> }
                  </select>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
  styles: [`
    .admin-row-changed {
      background-color: rgb(var(--c-accent) / 0.08);
    }
  `],
})
export default class AdminToolsComponent implements OnInit {
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
        return d.is_active !== s.is_active || d.model_override !== (s.model_override ?? '');
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
    this.draftTasks.update((list) => list.map((t) => (t.task_type === taskType ? { ...t, is_active: isActive } : t)));
    this.saveMessage.set('');
  }

  setModel(taskType: string, value: string): void {
    this.draftTasks.update((list) => list.map((t) => (t.task_type === taskType ? { ...t, model_override: value } : t)));
    this.saveMessage.set('');
  }

  discard(): void {
    this.applySavedToDraft(this.savedTasks());
    this.saveMessage.set('');
  }

  saveAll(): void {
    const changed = this.changedTaskTypes();
    if (!changed.length) return;
    this.saving.set(true);
    forkJoin(
      changed.map((taskType) => {
        const draft = this.draftTasks().find((t) => t.task_type === taskType)!;
        return this.admin.updateTask(taskType, {
          is_active: draft.is_active,
          model_override: draft.model_override || null,
        });
      }),
    ).subscribe({
      next: (updatedList) => {
        const byType = new Map(updatedList.map((t) => [t.task_type, t]));
        this.savedTasks.update((list) => list.map((t) => byType.get(t.task_type) ?? t));
        this.applySavedToDraft(this.savedTasks());
        this.saving.set(false);
        this.saveMessage.set('Changes saved.');
      },
      error: (err) => this.handleAuthError(err),
    });
  }

  private reloadTasks(): void {
    this.admin.getTasks().subscribe({
      next: (tasks) => {
        this.savedTasks.set(tasks);
        this.applySavedToDraft(tasks);
        this.loading.set(false);
      },
      error: (err) => this.handleAuthError(err),
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

  private handleAuthError(err: { status?: number }): void {
    this.loading.set(false);
    this.saving.set(false);
    if (err.status === 401) {
      this.admin.logout();
      this.router.navigate(['/admin/login']);
      return;
    }
    this.loadError.set('Request failed. Is the backend running?');
  }
}

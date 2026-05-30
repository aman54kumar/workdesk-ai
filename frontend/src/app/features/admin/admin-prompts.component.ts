import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AdminService, PromptTemplate } from '../../core/services/admin.service';

@Component({
  selector: 'app-admin-prompts',
  standalone: true,
  imports: [FormsModule],
  template: `
    @if (loadError()) {
      <p class="text-sm text-danger">{{ loadError() }}</p>
    } @else if (loading()) {
      <p class="text-sm text-muted">Loading…</p>
    } @else {
      <div class="mb-4 flex flex-wrap gap-3">
        <select class="field-input text-sm" [ngModel]="selectedTask()" (ngModelChange)="selectTask($event)">
          @for (t of templates(); track t.task_type) {
            <option [value]="t.task_type">
              {{ t.task_type }}{{ t.is_overridden ? ' (custom)' : '' }}
            </option>
          }
        </select>
        @if (current()?.is_overridden) {
          <span class="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-xs text-accent">Override active</span>
        }
      </div>

      @if (current(); as tpl) {
        <label class="mb-3 flex items-center gap-2 text-sm">
          <input type="checkbox" [(ngModel)]="draftUseCompany" />
          Use company profile in system context
        </label>
        <label class="field-label">System prompt</label>
        <textarea class="field-input mb-4 w-full font-mono text-xs" rows="10" [(ngModel)]="draftSystem"></textarea>
        <label class="field-label">User template</label>
        <textarea class="field-input mb-4 w-full font-mono text-xs" rows="6" [(ngModel)]="draftUser"></textarea>
        @if (validationError()) {
          <p class="mb-3 text-sm text-danger">{{ validationError() }}</p>
        }
        <div class="flex gap-2">
          <button type="button" class="btn-primary text-sm" [disabled]="saving()" (click)="save()">Save</button>
          <button type="button" class="btn-secondary text-sm" [disabled]="saving()" (click)="reset()">Reset to default</button>
        </div>
        @if (saveMessage()) { <p class="mt-3 text-sm text-muted">{{ saveMessage() }}</p> }
      }
    }
  `,
})
export default class AdminPromptsComponent implements OnInit {
  private admin = inject(AdminService);
  private router = inject(Router);

  templates = signal<PromptTemplate[]>([]);
  selectedTask = signal('');
  loading = signal(true);
  saving = signal(false);
  loadError = signal('');
  saveMessage = signal('');
  validationError = signal('');

  draftSystem = '';
  draftUser = '';
  draftUseCompany = false;

  current = signal<PromptTemplate | null>(null);

  ngOnInit(): void {
    this.admin.getPrompts().subscribe({
      next: (list) => {
        this.templates.set(list);
        if (list.length) this.selectTask(list[0].task_type);
        this.loading.set(false);
      },
      error: (err) => this.onError(err),
    });
  }

  selectTask(taskType: string): void {
    this.selectedTask.set(taskType);
    const tpl = this.templates().find((t) => t.task_type === taskType) ?? null;
    this.current.set(tpl);
    if (tpl) {
      this.draftSystem = tpl.system;
      this.draftUser = tpl.user_template;
      this.draftUseCompany = tpl.use_company_profile;
    }
    this.validationError.set('');
    this.saveMessage.set('');
  }

  save(): void {
    const taskType = this.selectedTask();
    this.saving.set(true);
    this.validationError.set('');
    this.admin
      .savePrompt(taskType, {
        system: this.draftSystem,
        user_template: this.draftUser,
        use_company_profile: this.draftUseCompany,
      })
      .subscribe({
        next: (tpl) => this.refreshTemplate(tpl),
        error: (err) => {
          this.saving.set(false);
          if (err.status === 422) {
            this.validationError.set(err.error?.detail ?? 'Invalid template');
            return;
          }
          this.onError(err);
        },
      });
  }

  reset(): void {
    this.saving.set(true);
    this.admin.resetPrompt(this.selectedTask()).subscribe({
      next: (tpl) => this.refreshTemplate(tpl),
      error: (err) => this.onError(err),
    });
  }

  private refreshTemplate(tpl: PromptTemplate): void {
    this.templates.update((list) => list.map((t) => (t.task_type === tpl.task_type ? tpl : t)));
    this.selectTask(tpl.task_type);
    this.saving.set(false);
    this.saveMessage.set('Saved.');
  }

  private onError(err: { status?: number; error?: { detail?: string } }): void {
    this.loading.set(false);
    this.saving.set(false);
    if (err.status === 401) {
      this.admin.logout();
      this.router.navigate(['/admin/login']);
      return;
    }
    this.loadError.set('Request failed.');
  }
}

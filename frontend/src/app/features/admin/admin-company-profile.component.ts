import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AdminService, CompanyProfileSection } from '../../core/services/admin.service';

@Component({
  selector: 'app-admin-company-profile',
  standalone: true,
  imports: [FormsModule],
  template: `
    <p class="mb-4 text-sm text-muted">
      Sections are injected into tools that have “Use company profile” enabled in Prompt templates.
    </p>
    @if (loadError()) {
      <p class="text-sm text-danger">{{ loadError() }}</p>
    } @else if (loading()) {
      <p class="text-sm text-muted">Loading…</p>
    } @else {
      <div class="mb-4 flex justify-end gap-2">
        <button type="button" class="btn-secondary text-sm" (click)="addSection()">Add section</button>
        <button type="button" class="btn-primary text-sm" [disabled]="saving()" (click)="save()">
          {{ saving() ? 'Saving…' : 'Save all' }}
        </button>
      </div>
      <div class="space-y-4">
        @for (section of sections(); track section.id ?? section.key) {
          <div class="rounded-2xl border border-stroke bg-surface p-4">
            <div class="mb-3 flex flex-wrap items-center gap-3">
              <input class="field-input flex-1 text-sm" [(ngModel)]="section.label" placeholder="Label" />
              <label class="flex items-center gap-2 text-sm">
                <input type="checkbox" [(ngModel)]="section.enabled" />
                Enabled
              </label>
              <button type="button" class="btn-secondary text-xs" (click)="removeSection(section)">Remove</button>
            </div>
            <textarea class="field-input w-full text-sm" rows="5" [(ngModel)]="section.content" placeholder="Content (markdown-ish)"></textarea>
          </div>
        }
      </div>
      @if (saveMessage()) { <p class="mt-3 text-sm text-muted">{{ saveMessage() }}</p> }
    }
  `,
})
export default class AdminCompanyProfileComponent implements OnInit {
  private admin = inject(AdminService);
  private router = inject(Router);

  sections = signal<CompanyProfileSection[]>([]);
  loading = signal(true);
  saving = signal(false);
  loadError = signal('');
  saveMessage = signal('');

  ngOnInit(): void {
    this.admin.getCompanyProfile().subscribe({
      next: (rows) => {
        this.sections.set(rows);
        this.loading.set(false);
      },
      error: (err) => this.onError(err),
    });
  }

  addSection(): void {
    const n = this.sections().length;
    this.sections.update((list) => [
      ...list,
      {
        id: 0,
        key: `section_${Date.now()}`,
        label: 'New section',
        content: '',
        enabled: true,
        sort_order: n,
      },
    ]);
  }

  removeSection(section: CompanyProfileSection): void {
    if (section.id) {
      this.admin.deleteCompanySection(section.id).subscribe({
        next: () => this.sections.update((list) => list.filter((s) => s !== section)),
        error: (err) => this.onError(err),
      });
    } else {
      this.sections.update((list) => list.filter((s) => s !== section));
    }
  }

  save(): void {
    this.saving.set(true);
    const payload = this.sections().map((s, i) => ({
      id: s.id || undefined,
      key: s.key,
      label: s.label,
      content: s.content,
      enabled: s.enabled,
      sort_order: i,
    }));
    this.admin.saveCompanyProfile(payload).subscribe({
      next: (rows) => {
        this.sections.set(rows);
        this.saving.set(false);
        this.saveMessage.set('Saved.');
      },
      error: (err) => this.onError(err),
    });
  }

  private onError(err: { status?: number }): void {
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

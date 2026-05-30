import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AdminService } from '../../core/services/admin.service';
import { BrandLogoComponent } from '../../shared/components/brand-logo/brand-logo.component';

@Component({
  selector: 'app-admin-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, BrandLogoComponent],
  template: `
    <div class="min-h-screen bg-canvas px-4 py-8 text-content">
      <div class="mx-auto max-w-6xl">
        <header class="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <app-brand-logo [size]="36" [decorative]="true" />
            <div>
              <h1 class="text-2xl font-semibold leading-tight">Admin</h1>
              <p class="text-sm text-muted">WorkDesk AI configuration</p>
            </div>
          </div>
          <div class="flex shrink-0 items-center gap-2">
            <a routerLink="/" class="btn-secondary text-sm">Open app</a>
            <button type="button" class="btn-secondary text-sm" (click)="logout()">Sign out</button>
          </div>
        </header>

        <nav class="mb-6 flex flex-wrap gap-2 border-b border-stroke pb-3">
          <a routerLink="/admin/tools" routerLinkActive="admin-tab-active" class="admin-tab">Tools</a>
          <a routerLink="/admin/company-profile" routerLinkActive="admin-tab-active" class="admin-tab">
            Company profile
          </a>
          <a routerLink="/admin/prompts" routerLinkActive="admin-tab-active" class="admin-tab">Prompt templates</a>
          <a routerLink="/admin/analytics" routerLinkActive="admin-tab-active" class="admin-tab">Analytics</a>
          <a routerLink="/admin/feedback" routerLinkActive="admin-tab-active" class="admin-tab">Feedback</a>
        </nav>

        <router-outlet />
      </div>
    </div>
  `,
  styles: [`
    .admin-tab {
      border-radius: 0.5rem;
      padding: 0.375rem 0.75rem;
      font-size: 0.875rem;
      color: rgb(var(--c-muted));
    }
    .admin-tab-active {
      background: rgb(var(--c-accent) / 0.12);
      font-weight: 500;
      color: rgb(var(--c-accent));
    }
  `],
})
export default class AdminShellComponent {
  private admin = inject(AdminService);
  private router = inject(Router);

  logout(): void {
    this.admin.logout();
    this.router.navigate(['/admin/login']);
  }
}

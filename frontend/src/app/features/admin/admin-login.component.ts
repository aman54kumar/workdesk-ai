import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AdminService } from '../../core/services/admin.service';
import { BrandLogoComponent } from '../../shared/components/brand-logo/brand-logo.component';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [FormsModule, RouterLink, BrandLogoComponent],
  template: `
    <div class="flex min-h-screen items-center justify-center bg-canvas px-4 text-content">
      <div class="w-full max-w-md rounded-2xl border border-stroke bg-surface p-8 shadow-lg">
        <div class="mb-6 flex flex-col items-center gap-3">
          <app-brand-logo [size]="44" [decorative]="true" />
          <h1 class="text-xl font-semibold">Admin sign in</h1>
          <p class="text-center text-sm text-muted">Manage tools and model settings</p>
        </div>

        <form (ngSubmit)="onSubmit()" class="flex flex-col gap-4">
          <div>
            <label class="field-label" for="username">Username</label>
            <input
              id="username"
              type="text"
              [(ngModel)]="username"
              name="username"
              autocomplete="username"
              class="field-input w-full"
              required
            />
          </div>
          <div>
            <label class="field-label" for="password">Password</label>
            <input
              id="password"
              type="password"
              [(ngModel)]="password"
              name="password"
              autocomplete="current-password"
              class="field-input w-full"
              required
            />
          </div>

          @if (errorMessage()) {
            <p class="text-sm text-danger">{{ errorMessage() }}</p>
          }

          <button type="submit" class="btn-primary w-full" [disabled]="loading()">
            {{ loading() ? 'Signing in…' : 'Sign in' }}
          </button>
        </form>

        <p class="mt-6 text-center text-sm text-muted">
          <a routerLink="/" class="text-accent hover:underline">← Back to WorkDesk AI</a>
        </p>
      </div>
    </div>
  `,
})
export default class AdminLoginComponent {
  private admin = inject(AdminService);
  private router = inject(Router);

  username = '';
  password = '';
  loading = signal(false);
  errorMessage = signal('');

  onSubmit(): void {
    this.errorMessage.set('');
    this.loading.set(true);
    this.admin.login(this.username, this.password).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/admin']);
      },
      error: () => {
        this.loading.set(false);
        this.errorMessage.set('Invalid username or password.');
      },
    });
  }
}

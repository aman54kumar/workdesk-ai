import { Routes } from '@angular/router';
import { adminAuthGuard, adminGuestGuard } from './core/guards/admin-auth.guard';
import { taskActiveGuard } from './core/guards/task-active.guard';

export const routes: Routes = [
  {
    path: 'admin/login',
    canActivate: [adminGuestGuard],
    loadComponent: () => import('./features/admin/admin-login.component'),
  },
  {
    path: 'admin',
    canActivate: [adminAuthGuard],
    loadComponent: () => import('./features/admin/admin-shell.component'),
    children: [
      { path: '', redirectTo: 'tools', pathMatch: 'full' },
      {
        path: 'tools',
        loadComponent: () => import('./features/admin/admin-tools.component'),
      },
      {
        path: 'company-profile',
        loadComponent: () => import('./features/admin/admin-company-profile.component'),
      },
      {
        path: 'prompts',
        loadComponent: () => import('./features/admin/admin-prompts.component'),
      },
      {
        path: 'analytics',
        loadComponent: () => import('./features/admin/admin-analytics.component'),
      },
      {
        path: 'feedback',
        loadComponent: () => import('./features/admin/admin-feedback.component'),
      },
    ],
  },
  {
    path: '',
    loadComponent: () => import('./features/shell/shell.component'),
    children: [
      {
        path: '',
        loadComponent: () => import('./features/home/home.component'),
      },
      {
        path: 'feedback',
        loadComponent: () => import('./features/feedback/feedback.component'),
      },
      {
        path: 'email-composer',
        canActivate: [taskActiveGuard],
        loadComponent: () =>
          import('./features/tasks/email-composer/email-composer.component'),
      },
      {
        path: 'meeting-mom',
        canActivate: [taskActiveGuard],
        loadComponent: () =>
          import('./features/tasks/meeting-mom/meeting-mom.component'),
      },
      {
        path: 'summarise-doc',
        canActivate: [taskActiveGuard],
        loadComponent: () =>
          import('./features/tasks/summarise-doc/summarise-doc.component'),
      },
      {
        path: 'tone-fixer',
        canActivate: [taskActiveGuard],
        loadComponent: () =>
          import('./features/tasks/tone-fixer/tone-fixer.component'),
      },
      {
        path: 'translate',
        canActivate: [taskActiveGuard],
        loadComponent: () =>
          import('./features/tasks/translate/translate.component'),
      },
      {
        path: 'status-report',
        canActivate: [taskActiveGuard],
        loadComponent: () =>
          import('./features/tasks/status-report/status-report.component'),
      },
      {
        path: 'risk-register',
        canActivate: [taskActiveGuard],
        loadComponent: () =>
          import('./features/tasks/risk-register/risk-register.component'),
      },
      {
        path: 'explain-code',
        canActivate: [taskActiveGuard],
        loadComponent: () =>
          import('./features/tasks/explain-code/explain-code.component'),
      },
      {
        path: 'commit-message',
        canActivate: [taskActiveGuard],
        loadComponent: () =>
          import('./features/tasks/commit-message/commit-message.component'),
      },
      {
        path: 'bug-report',
        canActivate: [taskActiveGuard],
        loadComponent: () =>
          import('./features/tasks/bug-report/bug-report.component'),
      },
      {
        path: 'eligibility-check',
        canActivate: [taskActiveGuard],
        loadComponent: () =>
          import('./features/tasks/eligibility-check/eligibility-check.component'),
      },
      {
        path: 'de-ai-text',
        canActivate: [taskActiveGuard],
        loadComponent: () =>
          import('./features/tasks/de-ai-text/de-ai-text.component'),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];

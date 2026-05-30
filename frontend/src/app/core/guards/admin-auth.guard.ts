import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AdminService } from '../services/admin.service';

export const adminAuthGuard: CanActivateFn = () => {
  const admin = inject(AdminService);
  const router = inject(Router);
  if (admin.isLoggedIn()) {
    return true;
  }
  return router.createUrlTree(['/admin/login']);
};

export const adminGuestGuard: CanActivateFn = () => {
  const admin = inject(AdminService);
  const router = inject(Router);
  if (!admin.isLoggedIn()) {
    return true;
  }
  return router.createUrlTree(['/admin']);
};

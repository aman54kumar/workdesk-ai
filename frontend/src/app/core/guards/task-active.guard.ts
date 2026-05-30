import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs/operators';
import { TasksService } from '../services/tasks.service';

export const taskActiveGuard: CanActivateFn = (route) => {
  const tasksSvc = inject(TasksService);
  const router = inject(Router);
  const segment = route.routeConfig?.path ?? '';
  const path = segment ? `/${segment}` : '/';

  return tasksSvc.ensureLoaded().pipe(
    map(() => {
      if (tasksSvc.isPathActive(path)) {
        return true;
      }
      const fallback = tasksSvc.firstActivePath();
      return router.createUrlTree([fallback ?? '/']);
    }),
  );
};

import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface PublicTask {
  task_type: string;
  display_name: string;
  description: string;
  section: string;
  path: string;
  icon: string;
  input_count: number;
}

export interface NavGroup {
  section: string;
  items: {
    path: string;
    label: string;
    icon: string;
    description: string;
    task_type: string;
  }[];
}

@Injectable({ providedIn: 'root' })
export class TasksService {
  private http = inject(HttpClient);
  private tasksSignal = signal<PublicTask[]>([]);
  private loadPromise: Promise<PublicTask[]> | null = null;

  readonly tasks = this.tasksSignal.asReadonly();

  load(): Observable<PublicTask[]> {
    return this.http.get<PublicTask[]>(`${environment.apiUrl}/generate/tasks`).pipe(
      tap((tasks) => this.tasksSignal.set(tasks)),
    );
  }

  ensureLoaded(): Observable<PublicTask[]> {
    if (this.tasksSignal().length > 0) {
      return of(this.tasksSignal());
    }
    return this.load();
  }

  navGroups(favoriteTaskTypes: string[] = []): NavGroup[] {
    const favSet = new Set(favoriteTaskTypes);
    const pinned: NavGroup['items'] = [];
    const bySection = new Map<string, NavGroup['items']>();

    for (const task of this.tasksSignal()) {
      const item = {
        path: task.path,
        label: task.display_name,
        icon: task.icon,
        description: task.description,
        task_type: task.task_type,
      };
      if (favSet.has(task.task_type)) {
        pinned.push(item);
        continue;
      }
      const items = bySection.get(task.section) ?? [];
      items.push(item);
      bySection.set(task.section, items);
    }

    const groups: NavGroup[] = [];
    if (pinned.length) {
      groups.push({ section: 'Pinned', items: pinned });
    }
    groups.push(...[...bySection.entries()].map(([section, items]) => ({ section, items })));
    return groups;
  }

  isPathActive(path: string): boolean {
    return this.tasksSignal().some((t) => t.path === path || path.startsWith(t.path + '/'));
  }

  firstActivePath(): string | null {
    const first = this.tasksSignal()[0];
    return first?.path ?? null;
  }

  taskForPath(path: string): PublicTask | undefined {
    return this.tasksSignal().find((t) => path.startsWith(t.path));
  }
}

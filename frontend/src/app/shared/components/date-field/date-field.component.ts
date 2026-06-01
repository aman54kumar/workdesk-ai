import {
  Component,
  ElementRef,
  HostListener,
  Input,
  computed,
  forwardRef,
  inject,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

interface DayCell {
  key: string;
  day: number;
  iso: string;
  inMonth: boolean;
}

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] as const;
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

function parseIso(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? date : null;
}

function toIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

@Component({
  selector: 'app-date-field',
  standalone: true,
  template: `
    <div class="date-field">
      <button
        type="button"
        class="date-field-trigger"
        [disabled]="disabled"
        [attr.aria-label]="ariaLabel"
        [attr.aria-expanded]="open()"
        aria-haspopup="dialog"
        (click)="toggle($event)"
      >
        <span class="date-field-label" [class.date-field-placeholder]="!value()">{{ displayLabel() }}</span>
        <span class="date-field-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </span>
      </button>

      @if (open()) {
        <div class="date-field-popover" role="dialog" [attr.aria-label]="ariaLabel" (click)="$event.stopPropagation()">
          <div class="date-field-popover-header">
            <button type="button" class="date-field-nav" (click)="prevMonth($event)" aria-label="Previous month">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
              </svg>
            </button>
            <span class="date-field-month-title">{{ monthTitle() }}</span>
            <button type="button" class="date-field-nav" (click)="nextMonth($event)" aria-label="Next month">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
              </svg>
            </button>
          </div>

          <div class="date-field-weekdays">
            @for (day of weekdays; track day) {
              <span>{{ day }}</span>
            }
          </div>

          <div class="date-field-grid">
            @for (cell of calendarCells(); track cell.key) {
              <button
                type="button"
                class="date-field-day"
                [class.date-field-day-outside]="!cell.inMonth"
                [class.date-field-day-selected]="cell.iso === value()"
                [class.date-field-day-today]="cell.iso === todayIso"
                [class.date-field-day-disabled]="isDayDisabled(cell.iso)"
                [disabled]="isDayDisabled(cell.iso)"
                (click)="selectDay(cell.iso, $event)"
              >
                {{ cell.day }}
              </button>
            }
          </div>

          <div class="date-field-popover-footer">
            @if (canSelectToday()) {
              <button type="button" class="date-field-footer-btn" (click)="selectToday($event)">Today</button>
            }
            @if (value()) {
              <button type="button" class="date-field-footer-btn date-field-footer-muted" (click)="clear($event)">
                Clear
              </button>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }

    :host(.date-field-host-grow) {
      flex: 1 1 0%;
      min-width: 0;
    }

    .date-field {
      position: relative;
      width: 100%;
    }

    .date-field-trigger {
      display: flex;
      width: 100%;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      border-radius: 0.75rem;
      border: 1px solid rgb(var(--c-stroke));
      background: rgb(var(--c-surface-raised));
      padding: 0.625rem 0.875rem;
      font-size: 0.875rem;
      line-height: 1.25rem;
      color: rgb(var(--c-content));
      text-align: left;
      transition: border-color 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease;
      cursor: pointer;
    }

    html:not(.dark) .date-field-trigger {
      box-shadow: inset 0 1px 2px rgb(15 23 42 / 0.04);
    }

    html.dark .date-field-trigger {
      background: rgb(var(--c-surface-raised) / 0.7);
      box-shadow: 0 1px 2px rgb(0 0 0 / 0.2);
    }

    .date-field-trigger:hover:not(:disabled) {
      border-color: rgb(var(--c-accent) / 0.4);
    }

    .date-field-trigger:focus-visible {
      outline: none;
      border-color: rgb(var(--c-accent));
      box-shadow: 0 0 0 2px rgb(var(--c-accent) / 0.28);
    }

    .date-field-trigger:disabled {
      cursor: not-allowed;
      opacity: 0.55;
    }

    .date-field-label {
      min-width: 0;
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-weight: 500;
    }

    .date-field-placeholder {
      color: rgb(var(--c-faint));
      font-weight: 400;
    }

    .date-field-icon {
      display: flex;
      width: 1.125rem;
      height: 1.125rem;
      flex-shrink: 0;
      color: rgb(var(--c-accent));
    }

    .date-field-popover {
      position: absolute;
      top: calc(100% + 0.35rem);
      left: 0;
      z-index: 80;
      width: min(18.5rem, calc(100vw - 2rem));
      border-radius: 1rem;
      border: 1px solid rgb(var(--c-stroke) / 0.9);
      background: rgb(var(--c-surface));
      padding: 0.75rem;
      box-shadow:
        0 16px 40px rgb(15 23 42 / 0.14),
        0 2px 8px rgb(15 23 42 / 0.08);
    }

    html.dark .date-field-popover {
      box-shadow: 0 18px 48px rgb(0 0 0 / 0.45), 0 0 0 1px rgb(255 255 255 / 0.04);
    }

    .date-field-popover-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      margin-bottom: 0.65rem;
    }

    .date-field-month-title {
      font-size: 0.875rem;
      font-weight: 600;
      color: rgb(var(--c-content));
    }

    .date-field-nav {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.85rem;
      height: 1.85rem;
      border-radius: 0.5rem;
      border: 1px solid rgb(var(--c-stroke) / 0.7);
      background: rgb(var(--c-surface-raised));
      color: rgb(var(--c-muted));
      cursor: pointer;
      transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease;
    }

    .date-field-nav:hover {
      border-color: rgb(var(--c-accent) / 0.35);
      background: rgb(var(--c-accent) / 0.1);
      color: rgb(var(--c-accent));
    }

    .date-field-nav svg {
      width: 0.95rem;
      height: 0.95rem;
    }

    .date-field-weekdays {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 0.15rem;
      margin-bottom: 0.35rem;
    }

    .date-field-weekdays span {
      text-align: center;
      font-size: 0.65rem;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: rgb(var(--c-faint));
    }

    .date-field-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 0.15rem;
    }

    .date-field-day {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      aspect-ratio: 1;
      border: none;
      border-radius: 0.5rem;
      background: transparent;
      font-size: 0.8rem;
      font-weight: 500;
      color: rgb(var(--c-content));
      cursor: pointer;
      transition: background-color 0.12s ease, color 0.12s ease;
    }

    .date-field-day:hover {
      background: rgb(var(--c-accent) / 0.12);
      color: rgb(var(--c-accent));
    }

    .date-field-day-outside {
      color: rgb(var(--c-faint));
      opacity: 0.55;
    }

    .date-field-day-today:not(.date-field-day-selected) {
      box-shadow: inset 0 0 0 1px rgb(var(--c-accent) / 0.45);
    }

    .date-field-day-selected {
      background: rgb(var(--c-accent));
      color: white;
    }

    .date-field-day-selected:hover {
      background: rgb(var(--c-accent-hover));
      color: white;
    }

    .date-field-day-disabled {
      opacity: 0.35;
      cursor: not-allowed;
      pointer-events: none;
    }

    .date-field-day-disabled:hover {
      background: transparent;
      color: rgb(var(--c-content));
    }

    .date-field-popover-footer {
      display: flex;
      justify-content: flex-end;
      gap: 0.35rem;
      margin-top: 0.65rem;
      padding-top: 0.55rem;
      border-top: 1px solid rgb(var(--c-stroke) / 0.65);
    }

    .date-field-footer-btn {
      border: none;
      border-radius: 0.5rem;
      background: rgb(var(--c-accent) / 0.12);
      padding: 0.3rem 0.65rem;
      font-size: 0.75rem;
      font-weight: 600;
      color: rgb(var(--c-accent));
      cursor: pointer;
      transition: background-color 0.15s ease;
    }

    .date-field-footer-btn:hover {
      background: rgb(var(--c-accent) / 0.2);
    }

    .date-field-footer-muted {
      background: transparent;
      color: rgb(var(--c-muted));
      font-weight: 500;
    }

    .date-field-footer-muted:hover {
      background: rgb(var(--c-stroke) / 0.25);
      color: rgb(var(--c-content));
    }
  `,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DateFieldComponent),
      multi: true,
    },
  ],
  host: {
    class: 'date-field-host',
    '[class.date-field-host-grow]': 'grow',
  },
})
export class DateFieldComponent implements ControlValueAccessor {
  private hostEl = inject(ElementRef<HTMLElement>);

  @Input() ariaLabel = 'Date';
  @Input() grow = true;
  /** Earliest selectable day (YYYY-MM-DD). */
  @Input() minDate = '';
  /** Latest selectable day (YYYY-MM-DD). Defaults to today when empty. */
  @Input() maxDate = '';

  readonly weekdays = WEEKDAYS;
  readonly todayIso = toIso(new Date());

  readonly value = signal('');
  disabled = false;
  open = signal(false);
  viewYear = signal(new Date().getFullYear());
  viewMonth = signal(new Date().getMonth());

  private onChange: (value: string) => void = () => {};
  private onTouchedCb: () => void = () => {};

  displayLabel = computed(() => {
    const iso = this.value();
    if (!iso) return 'Select date';
    const date = parseIso(iso);
    if (!date) return 'Select date';
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  });

  monthTitle = computed(() => `${MONTHS[this.viewMonth()]} ${this.viewYear()}`);

  calendarCells = computed((): DayCell[] => {
    const year = this.viewYear();
    const month = this.viewMonth();
    const first = new Date(year, month, 1);
    const startPad = (first.getDay() + 6) % 7;
    const gridStart = new Date(year, month, 1 - startPad);

    const cells: DayCell[] = [];
    for (let i = 0; i < 42; i++) {
      const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
      const iso = toIso(date);
      cells.push({
        key: iso,
        day: date.getDate(),
        iso,
        inMonth: date.getMonth() === month,
      });
    }
    return cells;
  });

  @HostListener('document:click', ['$event'])
  closeOnOutsideClick(event: MouseEvent): void {
    if (!this.open()) return;
    const target = event.target;
    if (target instanceof Node && this.hostEl.nativeElement.contains(target)) {
      return;
    }
    this.open.set(false);
  }

  @HostListener('document:keydown.escape')
  closeOnEscape(): void {
    this.open.set(false);
  }

  writeValue(value: string | null): void {
    const iso = value ? this.clampIso(value) : '';
    this.value.set(iso);
    const parsed = parseIso(iso);
    if (parsed) {
      this.viewYear.set(parsed.getFullYear());
      this.viewMonth.set(parsed.getMonth());
    }
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouchedCb = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  toggle(event: Event): void {
    event.stopPropagation();
    if (this.disabled) return;
    const next = !this.open();
    if (next) {
      const anchor = parseIso(this.value()) ?? new Date();
      this.viewYear.set(anchor.getFullYear());
      this.viewMonth.set(anchor.getMonth());
    }
    this.open.set(next);
    if (!next) this.onTouchedCb();
  }

  prevMonth(event: Event): void {
    event.stopPropagation();
    if (this.viewMonth() === 0) {
      this.viewMonth.set(11);
      this.viewYear.update((y) => y - 1);
    } else {
      this.viewMonth.update((m) => m - 1);
    }
  }

  nextMonth(event: Event): void {
    event.stopPropagation();
    if (this.viewMonth() === 11) {
      this.viewMonth.set(0);
      this.viewYear.update((y) => y + 1);
    } else {
      this.viewMonth.update((m) => m + 1);
    }
  }

  isDayDisabled(iso: string): boolean {
    const max = this.effectiveMax();
    if (this.minDate && iso < this.minDate) return true;
    if (iso > max) return true;
    return false;
  }

  canSelectToday(): boolean {
    return !this.isDayDisabled(this.todayIso);
  }

  selectDay(iso: string, event: Event): void {
    event.stopPropagation();
    if (this.isDayDisabled(iso)) return;
    this.commit(this.clampIso(iso));
    this.open.set(false);
    this.onTouchedCb();
  }

  selectToday(event: Event): void {
    event.stopPropagation();
    if (!this.canSelectToday()) return;
    this.commit(this.clampIso(this.todayIso));
    this.open.set(false);
    this.onTouchedCb();
  }

  clear(event: Event): void {
    event.stopPropagation();
    this.commit('');
    this.open.set(false);
    this.onTouchedCb();
  }

  private commit(iso: string): void {
    const next = iso ? this.clampIso(iso) : '';
    this.value.set(next);
    this.onChange(next);
  }

  private effectiveMax(): string {
    return this.maxDate || this.todayIso;
  }

  private clampIso(iso: string): string {
    let out = iso;
    if (this.minDate && out < this.minDate) out = this.minDate;
    const max = this.effectiveMax();
    if (out > max) out = max;
    return out;
  }
}

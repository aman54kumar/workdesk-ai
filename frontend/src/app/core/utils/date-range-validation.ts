export interface DateBounds {
  minDate: string;
  maxDate: string;
}

function formatDisplay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Clamp an ISO date string to [min, max] when set. */
export function clampIsoDate(value: string, min: string, max: string): string {
  if (!value) return value;
  let out = value;
  if (min && out < min) out = min;
  if (max && out > max) out = max;
  return out;
}

export function validateDateRange(
  since: string,
  until: string,
  bounds: DateBounds,
): string | null {
  const { minDate, maxDate } = bounds;

  if (since) {
    if (since < minDate) {
      return `From date cannot be before ${formatDisplay(minDate)} (when records begin).`;
    }
    if (since > maxDate) {
      return 'From date cannot be in the future.';
    }
  }

  if (until) {
    if (until > maxDate) {
      return 'Until date cannot be after today.';
    }
    if (until < minDate) {
      return `Until date cannot be before ${formatDisplay(minDate)}.`;
    }
  }

  if (since && until && since > until) {
    return 'From date must be on or before the until date.';
  }

  return null;
}

export function normalizeRangeDates(
  since: string,
  until: string,
  bounds: DateBounds,
): { since: string; until: string } {
  let s = since;
  let u = until;
  if (s) s = clampIsoDate(s, bounds.minDate, bounds.maxDate);
  if (u) u = clampIsoDate(u, bounds.minDate, bounds.maxDate);
  if (s && u && s > u) u = s;
  return { since: s, until: u };
}

export function clientDateBoundsFallback(): DateBounds {
  const today = new Date();
  const iso = toLocalIso(today);
  return { minDate: iso, maxDate: iso };
}

function toLocalIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayLocalIso(): string {
  return toLocalIso(new Date());
}

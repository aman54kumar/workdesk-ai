const STORAGE_KEY = 'workdesk_system_id_v1';

/** Anonymous per-browser/device id for aggregate “unique systems” analytics only. */
export function getSystemId(): string {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing && /^[a-zA-Z0-9-]{8,64}$/.test(existing)) {
      return existing;
    }
    const id =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `wd-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    localStorage.setItem(STORAGE_KEY, id);
    return id;
  } catch {
    return `wd-${Date.now()}`;
  }
}

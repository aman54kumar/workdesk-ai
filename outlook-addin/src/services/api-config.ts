/** Proxied through Vite dev server to avoid HTTPS→HTTP mixed-content blocks in Outlook. */
export const DEV_PROXY_PATH = '/workdesk-api';

const API_STORAGE_KEY = 'workdesk_outlook_api_v1';
const APP_STORAGE_KEY = 'workdesk_outlook_app_v1';
export const DEFAULT_APP_URL = 'http://localhost:4200';

/** Default API base when nothing is saved (HTTPS add-in → use same-origin proxy). */
export function defaultApiBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    return `${window.location.origin}${DEV_PROXY_PATH}`;
  }
  return 'http://localhost:8000';
}

export function getApiBaseUrl(): string {
  try {
    const raw = localStorage.getItem(API_STORAGE_KEY);
    if (raw) {
      const trimmed = raw.trim().replace(/\/+$/, '');
      if (trimmed) return trimmed;
    }
  } catch {
    /* private mode */
  }
  return defaultApiBaseUrl();
}

export function setApiBaseUrl(url: string): void {
  const trimmed = url.trim().replace(/\/+$/, '');
  localStorage.setItem(API_STORAGE_KEY, trimmed || defaultApiBaseUrl());
}

export function getAppBaseUrl(): string {
  try {
    const raw = localStorage.getItem(APP_STORAGE_KEY);
    if (raw) {
      const trimmed = raw.trim().replace(/\/+$/, '');
      if (trimmed) return trimmed;
    }
  } catch {
    /* private mode */
  }
  return DEFAULT_APP_URL;
}

export function setAppBaseUrl(url: string): void {
  const trimmed = url.trim().replace(/\/+$/, '');
  localStorage.setItem(APP_STORAGE_KEY, trimmed || DEFAULT_APP_URL);
}

export function apiUrl(path: string): string {
  const base = getApiBaseUrl();
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

/** True when add-in (HTTPS) points at a plain HTTP API — browser will block fetch. */
export function isMixedContentApiUrl(apiBase = getApiBaseUrl()): boolean {
  if (typeof window === 'undefined') return false;
  if (window.location.protocol !== 'https:') return false;
  return apiBase.startsWith('http://');
}

export function mixedContentHelpText(): string {
  return (
    'This add-in is served over HTTPS but the API URL is HTTP. Browsers block that. ' +
    `Use ${defaultApiBaseUrl()} (Vite proxy) while npm run dev is running, or host the API on HTTPS.`
  );
}

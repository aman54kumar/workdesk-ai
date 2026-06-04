import { getAppBaseUrl } from './api-config';

/** Open the WorkDesk AI web app in the system browser. */
export function openWorkdeskApp(path = ''): void {
  const base = getAppBaseUrl();
  const p = path.startsWith('/') ? path : path ? `/${path}` : '';
  const url = `${base}${p}`;

  const ui = Office.context.ui as Office.Context['ui'] & {
    openBrowserWindow?: (url: string) => void;
  };

  if (typeof ui.openBrowserWindow === 'function') {
    ui.openBrowserWindow(url);
    return;
  }

  window.open(url, '_blank', 'noopener,noreferrer');
}

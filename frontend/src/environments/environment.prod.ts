/**
 * Production API URL: same hostname as the UI, backend on port 8000.
 * Works when the UI is served on port 80 and the API on 8000 on the same machine.
 * Local production smoke tests still use localhost:8000.
 */
function resolveApiUrl(): string {
  if (typeof window === 'undefined') {
    return 'http://localhost:8000';
  }
  const { protocol, hostname } = window.location;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:8000';
  }
  return `${protocol}//${hostname}:8000`;
}

export const environment = {
  production: true,
  get apiUrl(): string {
    return resolveApiUrl();
  },
};

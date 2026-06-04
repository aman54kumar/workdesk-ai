import { defineConfig } from 'vite';
import { resolve } from 'path';

/** HTTPS certs for Office sideload (run `npm run certs` once after `npm install`). */
async function httpsForOffice(): Promise<boolean | Record<string, unknown>> {
  try {
    const devCerts = await import('office-addin-dev-certs');
    const mod = devCerts.default ?? devCerts;
    return await mod.getHttpsServerOptions();
  } catch {
    console.warn(
      '\n[workdesk-outlook-addin] Using Vite default HTTPS. For Outlook, run:\n' +
        '  npm install\n' +
        '  npm run certs\n' +
        '  npm run dev\n',
    );
    return true;
  }
}

export default defineConfig(async () => {
  const https = await httpsForOffice();
  const proxyTarget =
    process.env.VITE_API_PROXY_TARGET?.trim() || 'http://127.0.0.1:8000';

  return {
    root: '.',
    server: {
      port: 3000,
      strictPort: true,
      https,
      proxy: {
        '/workdesk-api': {
          target: proxyTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/workdesk-api/, ''),
        },
      },
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'index.html'),
          taskpane: resolve(__dirname, 'taskpane.html'),
          settings: resolve(__dirname, 'settings.html'),
        },
      },
    },
  };
});

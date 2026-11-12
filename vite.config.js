import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));

const BASE = '/cancionero/';
const DEMO_DIR = 'public/demo/Cancionero';

/**
 * Módulo virtual `virtual:demo-manifest`: lista los archivos de la biblioteca
 * de demostración con un hash de contenido (equivale al eTag de OneDrive).
 */
function demoManifest() {
  const id = 'virtual:demo-manifest';
  const resolved = '\0' + id;
  const walk = (dir) =>
    readdirSync(dir).flatMap((name) => {
      const full = join(dir, name);
      return statSync(full).isDirectory() ? walk(full) : [full];
    });
  return {
    name: 'demo-manifest',
    resolveId: (s) => (s === id ? resolved : null),
    load(s) {
      if (s !== resolved) return null;
      const files = walk(DEMO_DIR)
        .filter((f) => !f.endsWith('.DS_Store'))
        .map((full) => {
          const buf = readFileSync(full);
          return {
            path: relative(DEMO_DIR, full).split(sep).join('/'),
            etag: createHash('sha1').update(buf).digest('hex').slice(0, 16),
            size: buf.length,
          };
        });
      return `export default ${JSON.stringify(files)};`;
    },
    configureServer(server) {
      server.watcher.add(DEMO_DIR);
      server.watcher.on('all', (_e, file) => {
        if (file.includes('demo')) {
          const mod = server.moduleGraph.getModuleById(resolved);
          if (mod) server.moduleGraph.invalidateModule(mod);
        }
      });
    },
  };
}

export default defineConfig({
  base: BASE,
  define: {
    __APP_VERSION__: JSON.stringify(`${pkg.version} (${new Date().toISOString().slice(0, 10)})`),
  },
  build: { target: ['es2020', 'safari15', 'chrome100'], chunkSizeWarningLimit: 1500 },
  plugins: [
    demoManifest(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Cancionero Bethel',
        short_name: 'Cancionero',
        description: 'Cancionero del equipo de música: acordes, partituras de batería y listas por evento.',
        lang: 'es',
        dir: 'ltr',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        orientation: 'any',
        background_color: '#000000',
        theme_color: '#000000',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App + demostración en la caché de instalación. pdf.js se incluye para
        // poder abrir PDF sin conexión desde el primer uso.
        globPatterns: ['**/*.{js,mjs,css,html,svg,png,woff2,webmanifest}', 'demo/**/*'],
        globIgnores: ['pdfjs/**'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: BASE + 'index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith(BASE + 'pdfjs/'),
            handler: 'CacheFirst',
            options: { cacheName: 'pdfjs-recursos', expiration: { maxEntries: 60 } },
          },
        ],
      },
    }),
  ],
});

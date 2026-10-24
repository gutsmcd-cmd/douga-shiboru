import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const MANIFEST_ID = '/douga-shiboru/'

function assertManifestId(): Plugin {
  return {
    name: 'assert-manifest-id',
    apply: 'build',
    enforce: 'post',
    closeBundle() {
      const manifest = JSON.parse(readFileSync(resolve('dist/manifest.webmanifest'), 'utf8')) as { id?: string }
      if (manifest.id !== MANIFEST_ID) throw new Error(`manifest id must be ${MANIFEST_ID}, got ${String(manifest.id)}`)
    },
  }
}

export default defineConfig({
  base: './',
  worker: { format: 'es' },
  optimizeDeps: { exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'] },
  build: { chunkSizeWarningLimit: 2000 },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-32.png', 'icons/icon-180.png'],
      manifest: {
        id: MANIFEST_ID,
        name: '動画しぼる',
        short_name: '動画しぼる',
        description: '動画を小さくしてLINEやメールで送りやすく。端末の中で変換。Video Shrinker: make videos smaller on your device, offline.',
        lang: 'ja',
        dir: 'ltr',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#16241d',
        theme_color: '#16241d',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest,mjs}'],
        maximumFileSizeToCacheInBytes: 30 * 1024 * 1024,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // ffmpeg.wasm core (slow fallback): download once, then offline.
            urlPattern: ({ url }) => url.hostname === 'cdn.jsdelivr.net',
            handler: 'CacheFirst',
            options: { cacheName: 'douga-shiboru-ffmpeg', expiration: { maxEntries: 6 }, cacheableResponse: { statuses: [0, 200] } },
          },
        ],
      },
    }),
    assertManifestId(),
  ],
})

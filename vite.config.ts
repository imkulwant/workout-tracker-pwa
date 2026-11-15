import { readFileSync } from 'node:fs'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * The headers Cloudflare applies to every path: the `/*` block of
 * public/_headers. `vite preview` serves them too, so local runs and the e2e
 * suite enforce the same Content-Security-Policy as production. The dev server
 * does not, because Vite's hot reload needs inline scripts.
 */
function allPathsHeaders(): Record<string, string> {
  const text = readFileSync(new URL('public/_headers', import.meta.url), 'utf8')
  const headers: Record<string, string> = {}
  let inBlock = false
  for (const line of text.split('\n')) {
    if (line.trim() === '') continue
    if (!/^\s/.test(line)) {
      inBlock = line.trim() === '/*'
    } else if (inBlock) {
      const colon = line.indexOf(':')
      headers[line.slice(0, colon).trim()] = line.slice(colon + 1).trim()
    }
  }
  return headers
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: 'generateSW',
      // A new service worker waits until the app tells it to take over, so a
      // release can never swap code in the middle of a workout.
      registerType: 'prompt',
      // An external script, not an inline one, because the CSP allows no
      // inline scripts.
      injectRegister: 'script',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon-180.png'],
      // iOS honours name, short_name, scope, icons, display, start_url, id and
      // theme_color. It ignores background_color, orientation and shortcuts,
      // so none of those carry any behaviour here.
      manifest: {
        id: '/',
        name: 'Gym Tracker',
        short_name: 'Gym',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#0B0D10',
        background_color: '#0B0D10',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        // iOS fetches startup images itself, not through the service worker.
        globIgnores: ['icons/startup-*.png'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  build: {
    // The CSP allows no data: URIs, so never inline assets into CSS or JS.
    assetsInlineLimit: 0,
  },
  preview: { headers: allPathsHeaders() },
})

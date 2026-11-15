import { copyFileSync } from 'node:fs'
import { join } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { CONTENT_SECURITY_POLICY } from './csp.ts'

/**
 * A GitHub Pages project site lives at https://<owner>.github.io/<repo>/, so
 * the built app needs that prefix on every URL. Build with BASE_PATH=/ for a
 * custom domain, which serves the app from the root.
 */
const PAGES_BASE = '/workout-tracker-pwa/'

/**
 * GitHub Pages has no single-page-app fallback: an unknown path such as
 * /history gets 404.html. Copying index.html there lets a deep link or a
 * reload on any screen load the app.
 */
function spaFallback404(): Plugin {
  let outDir = 'dist'
  return {
    name: 'spa-404-fallback',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir
    },
    closeBundle() {
      copyFileSync(join(outDir, 'index.html'), join(outDir, '404.html'))
    },
  }
}

/**
 * Adds the Content-Security-Policy and a no-referrer policy as <meta> tags,
 * first in <head> so they cover everything after them. Build only: Vite's dev
 * server injects an inline script for hot reload, which this policy blocks.
 */
function securityMeta(): Plugin {
  return {
    name: 'security-meta',
    apply: 'build',
    transformIndexHtml: () => [
      {
        tag: 'meta',
        injectTo: 'head-prepend',
        attrs: {
          'http-equiv': 'Content-Security-Policy',
          content: CONTENT_SECURITY_POLICY,
        },
      },
      {
        tag: 'meta',
        injectTo: 'head-prepend',
        attrs: { name: 'referrer', content: 'no-referrer' },
      },
    ],
  }
}

// https://vite.dev/config/
export default defineConfig(({ command, isPreview }) => {
  // The dev server stays at the root, so localhost:5173 just works. Builds and
  // `vite preview` use the deployment base.
  const base =
    command === 'build' || isPreview
      ? (process.env.BASE_PATH ?? PAGES_BASE)
      : '/'

  return {
    base,
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        strategies: 'generateSW',
        // A new service worker waits until the app tells it to take over, so
        // a release can never swap code in the middle of a workout.
        registerType: 'prompt',
        // An external script, not an inline one, because the CSP allows no
        // inline scripts.
        injectRegister: 'script',
        includeAssets: ['favicon.svg', 'icons/apple-touch-icon-180.png'],
        // iOS honours name, short_name, scope, icons, display, start_url, id
        // and theme_color. It ignores background_color, orientation and
        // shortcuts, so none of those carry any behaviour here. `id` carries
        // the base on purpose: iOS resolves it against the origin, which a
        // project site shares with every other site of the same owner.
        manifest: {
          id: base,
          name: 'Gym Tracker',
          short_name: 'Gym',
          start_url: base,
          scope: base,
          display: 'standalone',
          theme_color: '#0B0D10',
          background_color: '#0B0D10',
          icons: [
            {
              src: `${base}icons/icon-192.png`,
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: `${base}icons/icon-512.png`,
              sizes: '512x512',
              type: 'image/png',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
          // iOS fetches startup images itself, not through the service worker.
          globIgnores: ['icons/startup-*.png'],
          // Relative to the service worker, so it follows the base.
          navigateFallback: 'index.html',
          cleanupOutdatedCaches: true,
        },
      }),
      spaFallback404(),
      securityMeta(),
    ],
    build: {
      // The CSP allows no data: URIs, so never inline assets into CSS or JS.
      assetsInlineLimit: 0,
    },
  }
})

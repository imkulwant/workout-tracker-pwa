import { defineConfig, devices } from '@playwright/test'

const PORT = 4173
// The deployment path, with a trailing slash. Tests use relative paths such as
// `page.goto('history')`, because a leading slash would drop this prefix.
const BASE = '/workout-tracker-pwa/'
const SITE = `http://localhost:${PORT}${BASE}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: SITE,
    trace: 'on-first-retry',
  },
  // WebKit is the closest automated match to iOS Safari. It does not
  // reproduce standalone mode, the iOS keyboard or storage policy.
  projects: [{ name: 'iphone-webkit', use: { ...devices['iPhone 17'] } }],
  // The PWA only exists in a production build. It is served by a small server
  // that behaves like GitHub Pages (real 404s, no index fallback, a fixed
  // 10 minute cache), not by `vite preview`, which hides all of that.
  webServer: {
    command: 'npm run build && node scripts/serve-pages.mjs',
    url: SITE,
    reuseExistingServer: !process.env.CI,
  },
})

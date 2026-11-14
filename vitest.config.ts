import { defineConfig } from 'vitest/config'

// Date logic must be tested in the user's zone, which has daylight saving.
process.env.TZ = 'Europe/Stockholm'

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts'],
  },
})

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // The CSP allows no data: URIs, so never inline assets into CSS or JS.
    assetsInlineLimit: 0,
  },
})

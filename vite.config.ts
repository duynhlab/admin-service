import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import tailwindcss from '@tailwindcss/vite'

// Dev server pinned to :3009 — the port the realm's `admin-portal` client
// allowlists (RFC-0023; :3001 is the customer SPA, :3002 is Grafana).
export default defineConfig({
  plugins: [
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3009,
    strictPort: true,
  },
  preview: {
    port: 3009,
    strictPort: true,
  },
})

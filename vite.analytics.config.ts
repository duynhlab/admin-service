import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Separate dev entry: never imported by the app, routed around auth, or built
// by the Docker/production entry. Loopback only; no backend connection.
export default defineConfig({
  root: path.resolve(import.meta.dirname, 'previews/analytics'),
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  server: { host: '127.0.0.1', port: 3010, strictPort: true },
  build: { outDir: '../../dist-analytics-preview', emptyOutDir: true },
})

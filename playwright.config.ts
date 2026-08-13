import { defineConfig, devices } from '@playwright/test'

/**
 * E2E against the real local stack — no mocks (owner rule): Keycloak on
 * :8081 and the Envoy Gateway edge on :8080 must be up
 * (`cd ../homelab/local-stack && docker compose up -d`).
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env['CI'],
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3009',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    port: 3009,
    reuseExistingServer: true,
  },
})

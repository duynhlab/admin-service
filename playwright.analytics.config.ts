import { defineConfig, devices } from '@playwright/test'

// UI/component acceptance only. Does not qualify auth, APIs or the CDC pipeline.
export default defineConfig({
  testDir: './previews/analytics',
  testMatch: '*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: 0,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:3010', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: { command: 'npm run dev:analytics', url: 'http://127.0.0.1:3010', reuseExistingServer: !process.env['CI'] },
})

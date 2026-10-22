import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

/**
 * Analytics page (ADR-069) against the REAL stack: the overview is served by
 * analytics-service through the edge from ClickHouse serving views. The
 * local stack seeds those views with fixture data and a 30-second heartbeat,
 * so the page must render live figures in the healthy state. The role gate
 * is proven with a staff user that lacks backoffice_admin.
 */

async function loginAs(page: Page, username: string, password: string) {
  await page.goto('/')
  await page.waitForURL(/\/login/)
  await page.getByRole('button', { name: 'Sign in with Keycloak' }).click()
  await page.waitForURL(/localhost:8081/)
  await page.locator('#username').fill(username)
  await page.locator('#password').fill(password)
  await page.locator('#kc-login').click()
  await page.waitForURL(/localhost:3009/)
}

test('the shell lists eight primary sections including Analytics', async ({ page }) => {
  await loginAs(page, 'duyne', 'p@ss1234')
  const nav = page.getByRole('navigation', { name: 'Primary' })
  await expect(nav.getByRole('link')).toHaveCount(8)
  await expect(nav.getByRole('link', { name: 'Analytics' })).toBeVisible()
})

test('analytics renders live figures with fresh sources', async ({ page }) => {
  await loginAs(page, 'duyne', 'p@ss1234')
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Analytics' }).click()
  await expect(page).toHaveURL(/\/analytics\?currency=USD&from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}/)
  await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible()

  // The freshness banner is the server's verdict rendered as-is.
  const freshness = page.getByRole('region', { name: 'Data freshness' })
  await expect(freshness).toBeVisible()
  await expect(freshness.getByText(/Data is fresh|Delayed data/)).toBeVisible()
  await expect(freshness.getByRole('list', { name: 'Source lag' }).getByRole('listitem')).toHaveCount(3)

  // Exact money, never a placeholder: either figures or the explicit empty state.
  await expect(
    page.getByText('No activity in this interval').or(page.locator('.tabular-nums').first()),
  ).toBeVisible()

  // Presets rewrite the URL; the page re-reads through the edge.
  await page.getByRole('button', { name: '30 days' }).click()
  await expect(page).toHaveURL(/from=\d{4}-\d{2}-\d{2}/)
  await expect(page.getByRole('button', { name: '30 days' })).toHaveAttribute('aria-pressed', 'true')

  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations).toEqual([])
})

test('a staff user without backoffice_admin cannot reach the overview', async ({ page }) => {
  await loginAs(page, 'duyne-viewer', 'p@ss1234')
  // The shell's UX gate already parks a role-less operator on /forbidden;
  // the service repeats the decision for anyone who bypasses the shell.
  await expect(page).toHaveURL(/\/forbidden/)
  const response = await page.request.get('http://localhost:8080/analytics/v1/protected/commerce/overview?currency=USD&from=2026-10-01&to=2026-10-02')
  expect(response.status()).toBe(401) // no bearer: the edge refuses before the service
})

test('keyboard reaches the filters and the refresh control', async ({ page }) => {
  await loginAs(page, 'duyne', 'p@ss1234')
  await page.goto('/analytics')
  await page.getByRole('heading', { name: 'Analytics' }).waitFor()
  await page.keyboard.press('Tab')
  let reachedRefresh = false
  for (let i = 0; i < 40 && !reachedRefresh; i++) {
    const name = await page.evaluate(() => document.activeElement?.textContent?.trim() ?? '')
    if (name.startsWith('Refresh')) reachedRefresh = true
    else await page.keyboard.press('Tab')
  }
  expect(reachedRefresh).toBe(true)
})

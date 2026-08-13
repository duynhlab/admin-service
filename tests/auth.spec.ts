import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

/**
 * Foundation smoke: the full OIDC round-trip against the real local-stack
 * Keycloak (realm `duynhlab`, client `admin-portal`), the role gate, logout,
 * and axe scans. Demo users are seeded by the realm import: alice holds
 * `backoffice_admin`; bob is customer-only. Login is by username.
 */

async function loginViaKeycloak(page: Page, username: string, password: string) {
  await page.goto('/')
  await page.waitForURL(/\/login/)
  await page.getByRole('button', { name: 'Sign in with Keycloak' }).click()
  await page.waitForURL(/localhost:8081/)
  await page.locator('#username').fill(username)
  await page.locator('#password').fill(password)
  await page.locator('#kc-login').click()
  await page.waitForURL(/localhost:3009/)
}

test('operator logs in, sees the shell, and logs out', async ({ page }) => {
  await loginViaKeycloak(page, 'alice', 'password123')

  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  await expect(page.getByText('backoffice_admin')).toBeVisible()

  const nav = page.getByRole('navigation', { name: 'Primary' })
  for (const item of [
    'Dashboard',
    'Catalog',
    'Inventory',
    'Orders',
    'Payments',
    'Shipments',
    'Customers',
  ]) {
    await expect(nav.getByRole('link', { name: item })).toBeVisible()
  }

  // Sections without a backend slice say so — never placeholder data.
  await nav.getByRole('link', { name: 'Inventory' }).click()
  await expect(page.getByText('Waiting for its API slice')).toBeVisible()

  await page.getByRole('button', { name: 'Sign out' }).click()
  await page.waitForURL(/\/login/)
  await expect(
    page.getByRole('button', { name: 'Sign in with Keycloak' }),
  ).toBeVisible()
})

test('a customer without the role is stopped at the gate', async ({ page }) => {
  await loginViaKeycloak(page, 'bob', 'password123')

  await page.waitForURL(/\/forbidden/)
  await expect(page.getByRole('heading', { name: 'Access denied' })).toBeVisible()
  await expect(page.getByText('bob', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Sign out' }).click()
  await page.waitForURL(/\/login/)
})

test('login page has no serious accessibility violations', async ({ page }) => {
  await page.goto('/login')
  await expect(
    page.getByRole('button', { name: 'Sign in with Keycloak' }),
  ).toBeVisible()
  const results = await new AxeBuilder({ page }).analyze()
  expect(
    results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical'),
  ).toEqual([])
})

test('dashboard has no serious accessibility violations', async ({ page }) => {
  await loginViaKeycloak(page, 'alice', 'password123')
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  const results = await new AxeBuilder({ page }).analyze()
  expect(
    results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical'),
  ).toEqual([])
})

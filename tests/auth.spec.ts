import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

/**
 * Foundation smoke: the full OIDC round-trip against the real local-stack
 * Keycloak (WORKFORCE realm `duynhlab-staff`, client `admin-portal` —
 * ADR-050), the identity fence, logout, and axe scans. The operator `duyne`
 * is seeded by the staff realm import; store accounts live in the customer
 * realm and cannot sign in here at all. Login is by username.
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
  await loginViaKeycloak(page, 'duyne', 'p@ss1234')

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
  await nav.getByRole('link', { name: 'Catalog' }).click()
  await expect(page.getByText('Waiting for its API slice')).toBeVisible()

  await page.getByRole('button', { name: 'Sign out' }).click()
  await page.waitForURL(/\/login/)
  await expect(
    page.getByRole('button', { name: 'Sign in with Keycloak' }),
  ).toBeVisible()
})

test('a store account cannot sign in at all — wrong realm', async ({ page }) => {
  // ADR-050 identity fence, stronger than the old 403: alice exists only in
  // the CUSTOMER realm, so the staff realm rejects the credentials outright.
  await page.goto('/')
  await page.waitForURL(/\/login/)
  await page.getByRole('button', { name: 'Sign in with Keycloak' }).click()
  await page.waitForURL(/localhost:8081/)
  await expect(page).toHaveURL(/realms\/duynhlab-staff/)
  await page.locator('#username').fill('alice')
  await page.locator('#password').fill('password123')
  await page.locator('#kc-login').click()
  await expect(page.locator('#input-error')).toContainText(/Invalid username or password/i)
  await expect(page).toHaveURL(/realms\/duynhlab-staff/)
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
  await loginViaKeycloak(page, 'duyne', 'p@ss1234')
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  const results = await new AxeBuilder({ page }).analyze()
  expect(
    results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical'),
  ).toEqual([])
})

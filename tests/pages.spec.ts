import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

/**
 * Train 3 pages against the REAL stack: every section renders live data
 * through the edge, and the dashboard's attention cards are real reads.
 */

async function loginAsOperator(page: Page) {
  await page.goto('/')
  await page.waitForURL(/\/login/)
  await page.getByRole('button', { name: 'Sign in with Keycloak' }).click()
  await page.waitForURL(/localhost:8081/)
  await page.locator('#username').fill('duyne')
  await page.locator('#password').fill('p@ss1234')
  await page.locator('#kc-login').click()
  await page.waitForURL(/localhost:3009/)
}

test('dashboard cards show live numbers', async ({ page }) => {
  await loginAsOperator(page)
  await expect(page.getByText('Low / out of stock')).toBeVisible()
  await expect(page.getByText('Manual review')).toBeVisible()
  await expect(page.getByText('Recent orders')).toBeVisible()
  // Cards resolve to numbers (or an explicit unavailable) — never blank.
  await expect(page.getByText('unavailable').or(page.locator('.tabular-nums').first())).toBeVisible()
})

test('case views: order, payment (attempts + ledger), shipment, customer', async ({ page }) => {
  await loginAsOperator(page)
  const nav = page.getByRole('navigation', { name: 'Primary' })

  // Order case view — drill in from the list, expect fields + items table.
  await nav.getByRole('link', { name: 'Orders' }).click()
  await page.getByRole('table').getByRole('link').first().click()
  await expect(page.getByRole('heading', { name: /Order #/ })).toBeVisible()
  await expect(page.getByText('Total', { exact: true })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Qty' })).toBeVisible()

  // Payment case view — payment header plus BOTH history tables.
  await nav.getByRole('link', { name: 'Payments' }).click()
  await page.getByRole('table').getByRole('link').first().click()
  await expect(page.getByRole('heading', { name: /Payment #/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Attempts' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Ledger' })).toBeVisible()

  // Shipment detail.
  await nav.getByRole('link', { name: 'Shipments' }).click()
  await page.getByRole('table').getByRole('link').first().click()
  await expect(page.getByRole('heading', { name: /Shipment #/ })).toBeVisible()
  await expect(page.getByText('Tracking')).toBeVisible()

  // Customer detail — operator-safe profile with address.
  await nav.getByRole('link', { name: 'Customers' }).click()
  await page.getByLabel('Search customers').fill('alice')
  await page.getByRole('button', { name: 'Search' }).click()
  await page.getByRole('table').getByRole('link').first().click()
  await expect(page.getByText('Subject', { exact: true })).toBeVisible()
  await expect(page.getByText('Address', { exact: true })).toBeVisible()
})

test('recon run detail lists its discrepancies table', async ({ page }) => {
  await loginAsOperator(page)
  await page.goto('/payments?view=reconciliation')
  await page.getByRole('table').getByRole('link').first().click()
  await expect(page.getByRole('heading', { name: /Reconciliation run #/ })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Class' })).toBeVisible()
})

test('orders, payments, shipments, customers all render real tables', async ({ page }) => {
  await loginAsOperator(page)
  const nav = page.getByRole('navigation', { name: 'Primary' })

  await nav.getByRole('link', { name: 'Orders' }).click()
  await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible()

  await nav.getByRole('link', { name: 'Payments' }).click()
  await expect(page.getByRole('columnheader', { name: 'Amount' })).toBeVisible()
  await page.getByRole('tab', { name: 'reconciliation' }).click()
  await expect(page.getByRole('columnheader', { name: 'Discrepancies' })).toBeVisible()

  await nav.getByRole('link', { name: 'Shipments' }).click()
  await expect(page.getByRole('columnheader', { name: 'Tracking' })).toBeVisible()

  await nav.getByRole('link', { name: 'Customers' }).click()
  await page.getByLabel('Search customers').fill('alice')
  await page.getByRole('button', { name: 'Search' }).click()
  await expect(page).toHaveURL(/query=/)
  await expect(page.getByRole('table')).toBeVisible()
})

import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

/**
 * Inventory slice A against the REAL stack: balances render live data through
 * the edge, the receive command applies and shows up in the ledger with the
 * operator's subject as actor. Runs as alice (backoffice_admin).
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

test('balances list real rows and the low-stock filter round-trips the URL', async ({ page }) => {
  await loginAsOperator(page)
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Inventory' }).click()

  // Real seeded data: at least one balance row with a numeric ATP.
  const table = page.getByRole('table')
  await expect(table.getByRole('columnheader', { name: 'ATP' })).toBeVisible()
  await expect(table.getByRole('row').nth(1)).toBeVisible()

  // .click(), not .check(): the input is controlled through async router
  // navigation, so the DOM state settles only after the URL updates.
  await page.getByLabel(/Low stock only/).click()
  await expect(page).toHaveURL(/low_stock=true/)
  await expect(page.getByLabel(/Low stock only/)).toBeChecked()
  await page.getByLabel(/Low stock only/).click()
  await expect(page).not.toHaveURL(/low_stock/)

  // Views are URL state: movements view survives in the address bar.
  await page.getByRole('tab', { name: 'movements' }).click()
  await expect(page).toHaveURL(/view=movements/)
  await expect(table.getByRole('columnheader', { name: 'Actor' })).toBeVisible()
})

test('receive command applies through the dialog and lands in the ledger', async ({ page }) => {
  await loginAsOperator(page)
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Inventory' }).click()

  // Pin the view to one SKU so row assertions are deterministic.
  await page.getByLabel('Filter by SKU').fill('1')
  await page.getByRole('button', { name: 'Filter' }).click()
  // The router JSON-encodes string search params, so "1" rides URL-escaped.
  await expect(page).toHaveURL(/sku_id=/)

  const firstRow = page.getByRole('table').getByRole('row').nth(1)
  const before = Number(await firstRow.getByRole('cell').nth(2).innerText())

  await firstRow.getByRole('button', { name: 'Receive' }).click()
  await page.getByLabel('Quantity to receive').fill('3')
  await page.getByLabel(/Reason/).fill('PW-E2E')
  // The dialog previews the balance impact before the operator commits.
  await expect(page.getByText(`On hand ${before} →`)).toBeVisible()
  await page.getByRole('button', { name: 'Receive', exact: true }).last().click()
  await expect(page.getByText('Stock received.')).toBeVisible()
  await page.getByRole('button', { name: 'Close' }).first().click()

  // The invalidated balances query refetches the new on-hand.
  await expect(firstRow.getByRole('cell').nth(2)).toHaveText(String(before + 3))

  // And the ledger shows the RECEIVE with the operator's subject as actor.
  await page.getByRole('tab', { name: 'movements' }).click()
  const ledgerRow = page.getByRole('table').getByRole('row').nth(1)
  await expect(ledgerRow.getByText('RECEIVE')).toBeVisible()
  await expect(ledgerRow.getByText('PW-E2E')).toBeVisible()
  await expect(ledgerRow.getByText('d0e00000-0000-4000-8000-000000000001')).toBeVisible()
})

test('first stock for an untracked SKU bootstraps its balance row (ADR-053)', async ({ page }) => {
  await loginAsOperator(page)
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Inventory' }).click()

  // A SKU nothing has ever received against — untracked by construction.
  const sku = `e2e-boot-${Date.now()}`

  await page.getByRole('button', { name: 'Receive first stock' }).click()
  await page.getByLabel('SKU id').fill(sku)
  // The advisory lookup answers before submit: no row yet.
  await expect(page.getByText('No balance row yet — this receipt creates it.')).toBeVisible()
  await page.getByLabel(/Warehouse id/).fill('1')
  await page.getByLabel('Quantity to receive').fill('4')
  await page.getByLabel(/Reason/).fill('PW-BOOTSTRAP')
  await page.getByRole('button', { name: 'Receive', exact: true }).click()
  await expect(page.getByText('Stock received.')).toBeVisible()
  await page.getByRole('button', { name: 'Close' }).first().click()

  // The row now exists — the whole point of the affordance.
  await page.getByLabel('Filter by SKU').fill(sku)
  await page.getByRole('button', { name: 'Filter' }).click()
  const row = page.getByRole('table').getByRole('row').nth(1)
  await expect(row.getByText(sku)).toBeVisible()
  await expect(row.getByRole('cell').nth(2)).toHaveText('4')

  // And the ledger carries the RECEIVE with the operator's subject.
  await page.getByRole('tab', { name: 'movements' }).click()
  const ledgerRow = page.getByRole('table').getByRole('row').filter({ hasText: sku }).first()
  await expect(ledgerRow.getByText('RECEIVE')).toBeVisible()
  await expect(ledgerRow.getByText('d0e00000-0000-4000-8000-000000000001')).toBeVisible()
})

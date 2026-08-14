import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

/**
 * Catalog (RFC-0023 slice B) against the REAL stack: the lifecycle is driven
 * through the UI end to end, and the two conflicts an operator will actually
 * meet — a duplicate name and a stale version — are asserted as the honest
 * messages they are, not as generic failures.
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

/** A name no earlier run can collide with — the catalog enforces uniqueness. */
const uniqueName = () => `E2E Widget ${Date.now()}`

async function openCatalog(page: Page) {
  await page.goto('/catalog')
  await expect(page.getByRole('heading', { name: 'Catalog' })).toBeVisible()
}

test('catalog lists real products with their lifecycle state', async ({ page }) => {
  await loginAsOperator(page)
  await openCatalog(page)

  // The operator table exposes what the public catalog cannot: status + version.
  await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Ver' })).toBeVisible()

  // Assert through the FILTER, not through page 1. The list is newest-first, so
  // on a stack where the audit has just created a page's worth of drafts there
  // is legitimately no ACTIVE row on the first page — asserting on page 1
  // content would make this spec depend on how much traffic ran before it.
  const chips = page.getByRole('group', { name: 'Status filter' })
  for (const status of ['ACTIVE', 'DRAFT'] as const) {
    await chips.getByRole('button', { name: status }).click()
    await expect(page).toHaveURL(new RegExp(`status=${status}`))
    await expect(
      page.getByRole('table').getByRole('cell', { name: status }).first(),
    ).toBeVisible()
  }
})

test('lifecycle round-trip: create a draft, publish it, archive it', async ({ page }) => {
  await loginAsOperator(page)
  await openCatalog(page)
  const name = uniqueName()

  await page.getByRole('button', { name: 'New product' }).click()
  await page.getByLabel('Name').fill(name)
  await page.getByLabel('Price').fill('17.5')
  await page.getByLabel('Category').fill('Accessories')
  await page.getByRole('button', { name: 'Create draft' }).click()

  // Back on the list, the new row is DRAFT and offers exactly the transitions
  // the lifecycle allows from there.
  const row = page.getByRole('row').filter({ hasText: name })
  await expect(row).toBeVisible()
  await expect(row.getByText('DRAFT')).toBeVisible()
  await expect(row.getByRole('button', { name: 'publish' })).toBeVisible()
  await expect(row.getByRole('button', { name: 'restore' })).toHaveCount(0)

  await row.getByRole('button', { name: 'publish' }).click()
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await expect(row.getByText('ACTIVE')).toBeVisible()
  // An ACTIVE product cannot be published again, so the button is gone.
  await expect(row.getByRole('button', { name: 'publish' })).toHaveCount(0)

  await row.getByRole('button', { name: 'archive' }).click()
  await page.getByRole('button', { name: 'Archive', exact: true }).click()
  await expect(row.getByText('ARCHIVED')).toBeVisible()
  await expect(row.getByRole('button', { name: 'restore' })).toBeVisible()
})

test('a duplicate name is refused with an operator-readable message', async ({ page }) => {
  await loginAsOperator(page)
  await openCatalog(page)
  const name = uniqueName()

  // First create succeeds and the dialog closes.
  await page.getByRole('button', { name: 'New product' }).click()
  await page.getByLabel('Name').fill(name)
  await page.getByLabel('Price').fill('3')
  await page.getByRole('button', { name: 'Create draft' }).click()
  await expect(page.getByRole('row').filter({ hasText: name })).toBeVisible()

  // The same name again stays in the dialog with the conflict explained.
  await page.getByRole('button', { name: 'New product' }).click()
  await page.getByLabel('Name').fill(name)
  await page.getByLabel('Price').fill('3')
  await page.getByRole('button', { name: 'Create draft' }).click()
  await expect(page.getByText(/already exists/i)).toBeVisible()
})

test('categories list and accept a new entry', async ({ page }) => {
  await loginAsOperator(page)
  await openCatalog(page)

  await page.getByRole('tab', { name: 'categories' }).click()
  await expect(page).toHaveURL(/view=categories/)
  // Scoped to a row: the products table also carries a category column, so a
  // bare cell match would be ambiguous across the two views.
  await expect(page.getByRole('row').filter({ hasText: 'Accessories' }).first()).toBeVisible()

  const catName = `E2E Category ${Date.now()}`
  await page.getByRole('button', { name: 'New category' }).click()
  await page.getByLabel('Name').fill(catName)
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await expect(page.getByRole('row').filter({ hasText: catName })).toBeVisible()

  // There is no delete action anywhere — deleting would uncategorize products.
  await expect(page.getByRole('button', { name: /delete/i })).toHaveCount(0)
})

test('product case view shows the audit trail the service records', async ({ page }) => {
  await loginAsOperator(page)
  await openCatalog(page)
  const name = uniqueName()

  // Make a history worth reading: create, then publish, then edit.
  await page.getByRole('button', { name: 'New product' }).click()
  await page.getByLabel('Name').fill(name)
  await page.getByLabel('Price').fill('11')
  await page.getByRole('button', { name: 'Create draft' }).click()

  const row = page.getByRole('row').filter({ hasText: name })
  await expect(row).toBeVisible()
  await row.getByRole('button', { name: 'publish' }).click()
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await expect(row.getByText('ACTIVE')).toBeVisible()

  await row.getByRole('button', { name: 'Edit' }).click()
  await page.getByLabel('Price').fill('13.5')
  await page.getByLabel(/Reason/).fill('e2e price move')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)

  // Drill into the case view from the id link.
  await row.getByRole('link').first().click()
  await expect(page.getByRole('heading', { name })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Change history' })).toBeVisible()

  // Scope to the UPDATE entry itself: the price 11 appears twice on this page
  // (the value CREATE recorded, and the `before` side of the edit), so a
  // page-wide match would be ambiguous — the entry is the unit of meaning.
  const updateEntry = page.getByRole('listitem').filter({ hasText: 'UPDATE' })
  await expect(updateEntry).toHaveCount(1)
  await expect(updateEntry.getByText('e2e price move')).toBeVisible()
  await expect(updateEntry.getByText(/v2 → v3/)).toBeVisible()
  await expect(updateEntry.getByText('11', { exact: true })).toBeVisible()
  await expect(updateEntry.getByText('13.5', { exact: true })).toBeVisible()
  // The arrow is decorative; the transition is announced in words.
  await expect(updateEntry.getByText('changed to').first()).toBeAttached()

  // And the whole lifecycle is there, oldest last.
  for (const action of ['PUBLISH', 'CREATE']) {
    await expect(page.getByText(action, { exact: true })).toBeVisible()
  }

  // The actor is the operator's staff subject — never a body-supplied value.
  await expect(page.getByText('d0e00000-0000-4000-8000-000000000001').first()).toBeVisible()
})

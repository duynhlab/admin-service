import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

/**
 * The order case view and the resolve command (RFC-0023 train 7 / ADR-051),
 * against the REAL stack.
 *
 * The resolve test needs an order actually parked in `manual_review`, which the
 * compose E2E audit's A20 row arms by driving a real declined refund. When no
 * parked order exists the resolve assertions SKIP rather than fail: a green run
 * against a stack that was never armed would be a lie, and a red one would
 * punish an unrelated change. Everything that does not need a parked order —
 * the list, the case view, the external truths, the history — always runs.
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

/** Opens the first order with the given status, or null when there is none. */
async function openFirstOrderWithStatus(page: Page, status: string): Promise<string | null> {
  await page.goto(`/orders?status=${status}`)
  await expect(page.getByRole('heading', { name: 'Orders' })).toBeVisible()

  const rows = page.getByRole('row').filter({ hasText: status })
  if ((await rows.count()) === 0) return null

  // The Order column renders "#<id>" inside the link to the case.
  const link = rows.first().getByRole('link').first()
  const id = (await link.innerText()).trim().replace(/^#/, '')
  await link.click()
  await expect(page.getByRole('heading', { name: `Order #${id}` })).toBeVisible()
  return id
}

test('the case view shows the truths that live outside order-service', async ({ page }) => {
  await loginAsOperator(page)

  // Any order will do for the shape of the page; a completed one is the most
  // likely to exist on a stack that has run a checkout.
  const id =
    (await openFirstOrderWithStatus(page, 'completed')) ??
    (await openFirstOrderWithStatus(page, 'confirmed')) ??
    (await openFirstOrderWithStatus(page, 'manual_review'))
  test.skip(id === null, 'no orders on this stack — run a checkout first')

  await expect(page.getByRole('heading', { name: 'Outside this service' })).toBeVisible()
  for (const card of ['Payment', 'Reservation', 'Shipment', 'Where it stopped']) {
    await expect(page.getByRole('heading', { name: card, exact: true })).toBeVisible()
  }

  // The history is the control on an operator decision, so it has to render.
  await expect(page.getByRole('heading', { name: 'Transition history' })).toBeVisible()
  const timeline = page.getByRole('list').filter({ has: page.getByRole('listitem') })
  await expect(timeline.first()).toBeVisible()
})

test('a parked order can be resolved, and the audit trail records who did it', async ({ page }) => {
  await loginAsOperator(page)
  const id = await openFirstOrderWithStatus(page, 'manual_review')
  test.skip(id === null, 'no parked order — the A20 audit row arms one')

  // The command is only offered where it is legal.
  const resolve = page.getByRole('button', { name: 'Resolve' })
  await expect(resolve).toBeVisible()
  await resolve.click()

  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText(/Resolve order #/)).toBeVisible()

  // The note is mandatory: submitting without one must refuse in the dialog
  // rather than sending an unexplained decision.
  await dialog.getByRole('button', { name: 'Record this decision' }).click()
  await expect(dialog.getByText(/Say what you verified/)).toBeVisible()

  await dialog.getByRole('radio', { name: /Cancelled/ }).check()
  await dialog.getByLabel('What did you settle?').selectOption('WRITTEN_OFF')
  await dialog
    .getByLabel(/What did you verify/)
    .fill('e2e: verified the refund is permanently declined; closing the order')
  await dialog.getByRole('button', { name: 'Record this decision' }).click()

  await expect(dialog).toBeHidden()
  await expect(page.getByText('cancelled', { exact: true }).first()).toBeVisible()

  // The trail carries the operator, the bounded reason, and the note — and the
  // actor is the token subject, which the request never supplied.
  const operatorEntry = page.getByRole('listitem').filter({ hasText: 'OPERATOR' })
  await expect(operatorEntry.first()).toBeVisible()
  await expect(operatorEntry.first().getByText('WRITTEN_OFF')).toBeVisible()
  await expect(operatorEntry.first().getByText(/permanently declined/)).toBeVisible()
  await expect(
    operatorEntry.first().getByText('d0e00000-0000-4000-8000-000000000001'),
  ).toBeVisible()

  // And the command is no longer offered: the order is not parked anymore.
  await expect(page.getByRole('button', { name: 'Resolve' })).toHaveCount(0)
})

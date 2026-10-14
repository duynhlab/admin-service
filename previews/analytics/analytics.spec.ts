import { readdirSync, readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { availability, filtersSchema, money, overviewSchema } from '../../src/features/analytics/contract'
import { defaultFilters, makeOverview, previewTime } from './fixtures'

// These are explicit prototype UI fixtures, not mocked application E2E.
test('freshness boundaries hide expired, unknown and future data', () => {
  const data = makeOverview(defaultFilters, 'healthy')
  for (const [seconds, result] of [[120, 'healthy'], [120.001, 'stale'], [300, 'stale'], [300.001, 'unavailable']] as const) {
    const at = previewTime - seconds * 1000
    for (const source of data.meta.sources) { source.synced_at = new Date(at).toISOString(); source.lag_seconds = seconds }
    data.meta.data_through = new Date(at).toISOString()
    expect(availability(data, previewTime)).toBe(result)
  }
  expect(availability(makeOverview(defaultFilters, 'unknown'), previewTime)).toBe('unavailable')
  const future = makeOverview(defaultFilters, 'healthy')
  future.meta.sources[0]!.synced_at = new Date(previewTime + 1000).toISOString()
  expect(availability(future, previewTime)).toBe('unavailable')
  const expired = makeOverview(defaultFilters, 'healthy')
  expect(availability(expired, previewTime + 301_000)).toBe('unavailable')
})

test('range and money contract rejects ambiguity and preserves currency units', () => {
  for (const input of [
    { ...defaultFilters, to: defaultFilters.from }, { ...defaultFilters, from: '2026-02-30' },
    { ...defaultFilters, from: '2026-01-01' }, { ...defaultFilters, currency: 'ANY' },
    { ...defaultFilters, sql: 'SELECT 1' },
  ]) expect(filtersSchema.safeParse(input).success).toBe(false)
  expect(money('12345', 'USD')).toBe('$123.45')
  expect(money('-1', 'USD')).toBe('-$0.01')
  expect(money('900719925474099312345', 'USD')).toBe('$9,007,199,254,740,993,123.45')
  expect(money(null, 'USD')).toBe('—')
  const duplicate = makeOverview(defaultFilters, 'healthy')
  duplicate.meta.sources[0] = duplicate.meta.sources[1]!
  expect(overviewSchema.safeParse(duplicate).success).toBe(false)
})

test('illustrative trend reconciles with the displayed totals', () => {
  for (const currency of ['USD'] as const) {
    const data = makeOverview({ ...defaultFilters, currency }, 'healthy')
    const sum = data.trend.reduce((value, row) => value + BigInt(row.net_captured_minor), 0n)
    expect(sum.toString()).toBe(data.kpis.net_captured_minor)
    expect(BigInt(data.kpis.settled_capture_minor) - BigInt(data.kpis.refunded_minor)).toBe(sum)
  }
})

test('filters, theme and history work without any backend requests', async ({ page }) => {
  const errors: string[] = []
  const requests: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('request', (request) => requests.push(request.url()))
  await page.goto('/')
  await expect(page.getByText('Data is fresh', { exact: false })).toBeVisible()
  await expect(page.getByText('Design preview · Illustrative data only')).toBeVisible()
  await page.getByRole('button', { name: '30 days', exact: true }).click()
  await expect(page).toHaveURL(/from=2026-09-13/)
  await page.getByLabel('From · UTC', { exact: true }).fill('2026-10-01')
  await page.getByRole('button', { name: 'Apply', exact: true }).click()
  await expect(page).toHaveURL(/from=2026-10-01/)
  await expect(page.getByRole('region', { name: 'Commerce KPIs' })).toContainText('$')
  await page.goBack()
  await expect(page.getByLabel('Currency', { exact: true })).toHaveValue('USD')
  await page.getByRole('button', { name: 'Show data table' }).click()
  await expect(page.getByRole('table', { name: /Daily capture values/ })).toBeVisible()
  await page.getByRole('button', { name: 'Use dark theme' }).click()
  await expect(page.locator('html')).toHaveClass('dark')
  expect(errors).toEqual([])
  expect(requests.every((url) => url.startsWith('http://127.0.0.1:3010/'))).toBe(true)
})

test('invalid submitted range stays out of URL and queries', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('From · UTC', { exact: true }).fill('2026-01-01')
  await page.getByRole('button', { name: 'Apply', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('1 to 90 days')
  expect(page.url()).not.toContain('2026-01-01')
  await page.goto('/?from=2026-10-13&to=2026-10-01')
  await expect(page.getByLabel('From · UTC', { exact: true })).toHaveValue(defaultFilters.from)
})

for (const [scenario, text] of [
  ['loading', 'Loading analytics'], ['empty', 'No activity in this interval'],
  ['stale', 'Delayed data'], ['unavailable', 'Analytics is unavailable'],
  ['unknown', 'Analytics is unavailable'], ['error', 'Could not load analytics'],
  ['refresh-error', 'Refresh failed.'], ['forbidden', 'Analytics access required'],
  ['awaiting', 'Analytics is not connected yet'],
]) {
  test(`state: ${scenario}`, async ({ page }) => {
    await page.goto(`/?scenario=${scenario}`)
    await expect(page.getByText(text!, { exact: false }).first()).toBeVisible()
    if (['unavailable', 'unknown', 'error', 'forbidden', 'awaiting'].includes(scenario!)) {
      await expect(page.getByRole('region', { name: 'Commerce KPIs' })).toHaveCount(0)
    }
    if (scenario === 'error' || scenario === 'unavailable') {
      await page.getByRole('button', { name: 'Try again' }).click()
      await expect(page.getByText('Data is fresh', { exact: false })).toBeVisible()
    }
  })
}

for (const theme of ['light', 'dark']) {
  for (const width of [390, 1440]) {
    test(`accessible ${theme} at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 })
      await page.goto(`/?theme=${theme}`)
      await expect(page.getByText('Data is fresh', { exact: false })).toBeVisible()
      await expect(page.locator('.recharts-surface')).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
      expect(audit.violations).toEqual([])
      await page.screenshot({ path: `/tmp/rfc0030-analytics-${theme}-${width}.png`, fullPage: true })
    })
  }
}

test('keyboard can reach preview and content controls', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Data is fresh', { exact: false })).toBeVisible()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Skip to analytics' })).toBeFocused()
  await page.keyboard.press('Enter')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeFocused()
})


test('production bundle excludes preview and fixtures', () => {
  const assets = readdirSync('dist/assets').filter((name) => name.endsWith('.js'))
  expect(assets.length).toBeGreaterThan(0)
  const bundle = assets.map((name) => readFileSync(`dist/assets/${name}`, 'utf8')).join('\n')
  for (const marker of ['analytics-design-preview', 'Illustrative data only', 'preview-1', 'Commerce intelligence']) {
    expect(bundle).not.toContain(marker)
  }
  expect(readFileSync('src/routeTree.gen.ts', 'utf8')).not.toContain('analytics')
})


test('large integer money uses an exact table instead of an unsafe chart', async ({ page }) => {
  await page.goto('/?scenario=large-money')
  await expect(page.getByText('Amounts are too large to chart accurately. Exact values are shown below.')).toBeVisible()
  await expect(page.getByRole('table', { name: /Daily capture values/ })).toContainText('$9,007,199,254,740,993,123.45')
  await expect(page.getByRole('img', { name: /Daily capture trend/ })).toHaveCount(0)
})

test('money contract rejects numeric, fractional and noncanonical values', () => {
  const data = makeOverview(defaultFilters, 'healthy')
  for (const value of [1, 9007199254740992, '1.5', '01', '-0', '+1', '1e3']) {
    expect(overviewSchema.safeParse({ ...data, kpis: { ...data.kpis, settled_capture_minor: value } }).success).toBe(false)
  }
  expect(filtersSchema.safeParse({ ...defaultFilters, currency: 'VND' }).success).toBe(false)
})

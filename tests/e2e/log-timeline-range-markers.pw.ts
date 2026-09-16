import { expect, test } from '@playwright/test'

const rangeMarkerLog = `01:00:00 SEND S2F41 W
<L,2
  <A 'START'>
  <L,0
  >
>.

01:00:01 SEND S1F1 W
<L,0
>.`

test('syncs range points to existing and virtual timeline nodes', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/tools/log-timeline-analyzer')
  await page.waitForLoadState('networkidle')

  await page.locator('input[type="file"][accept=".log,.txt"]').setInputFiles({
    name: 'range-markers.log',
    mimeType: 'text/plain',
    buffer: Buffer.from(rangeMarkerLog)
  })

  await expect(page.locator('.el-loading-mask')).toHaveCount(0)
  const businessItem = page.getByTestId('timeline-item').filter({ hasText: 'RCMD: START' })
  await expect(businessItem).toBeVisible()

  await page.locator('.cm-line').filter({ hasText: 'SEND S2F41' }).click({ button: 'right' })
  await page.getByRole('button', { name: '标记区间起始点' }).click()
  await expect(businessItem).toHaveAttribute('data-range-markers', 'start')
  await expect(businessItem.getByText('起点', { exact: true })).toBeVisible()

  await page.locator('.cm-line').filter({ hasText: 'SEND S1F1' }).click({ button: 'right' })
  await page.getByRole('button', { name: '标记区间结束点' }).click()

  const virtualItem = page.getByTestId('timeline-item').filter({ hasText: '区间结束点' })
  await expect(virtualItem).toBeVisible()
  await expect(virtualItem).toHaveAttribute('data-timeline-item-type', 'RangeMarker')
  await expect(virtualItem).toHaveAttribute('data-range-markers', 'end')
  await expect(virtualItem.locator('input[type="checkbox"]')).toHaveCount(0)
  await expect(page.getByTestId('timeline-item').locator('input[type="checkbox"]')).toHaveCount(1)

  await page.screenshot({ path: testInfo.outputPath('range-markers-desktop.png'), fullPage: true })

  await page.setViewportSize({ width: 390, height: 844 })
  await virtualItem.scrollIntoViewIfNeeded()
  await expect(virtualItem).toBeVisible()
  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(horizontalOverflow).toBe(false)
  await page.screenshot({ path: testInfo.outputPath('range-markers-mobile.png'), fullPage: true })
})

import { expect, test } from '@playwright/test'

const malformedSml = `S6F11 W
<L,2
  ignored text
  <A 'value'>
>.
>`

test('shows structured diagnostics and locates their source ranges', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/tools/secs-sml')
  await page.waitForLoadState('networkidle')

  const source = page.locator('textarea[placeholder="请输入原始日志..."]')
  await source.fill(malformedSml)
  await page.getByRole('button', { name: '格式化' }).click()

  const panel = page.getByTestId('diagnostics-panel')
  await expect(panel).toBeVisible()
  await expect(panel.getByText('3 警告')).toBeVisible()
  await expect(panel.locator('.diagnostic-row')).toHaveCount(3)
  await expect(page.locator('.el-loading-mask')).toHaveCount(0)

  await panel.getByText('列表中存在未识别文本').click()
  const selection = await source.evaluate((element: HTMLTextAreaElement) => ({
    selected: element.value.slice(element.selectionStart, element.selectionEnd),
    focused: document.activeElement === element
  }))
  expect(selection.focused).toBe(true)
  expect(selection.selected).toContain('ignored text')

  const editorArea = page.locator('.grid').first()
  const editorBox = await editorArea.boundingBox()
  const panelBox = await panel.boundingBox()
  expect(editorBox).not.toBeNull()
  expect(panelBox).not.toBeNull()
  expect((editorBox?.y || 0) + (editorBox?.height || 0)).toBeLessThanOrEqual((panelBox?.y || 0) + 1)

  await page.screenshot({ path: testInfo.outputPath('diagnostics-desktop.png'), fullPage: true })

  await page.getByTestId('parse-mode').getByText('严格', { exact: true }).click()
  await page.getByRole('button', { name: '格式化' }).click()
  await expect(panel.getByText('3 错误')).toBeVisible()

  await page.getByRole('button', { name: '收起诊断' }).click()
  await expect(panel.locator('.diagnostics-list')).toBeHidden()
  await page.getByRole('button', { name: '展开诊断' }).click()
  await expect(panel.locator('.diagnostics-list')).toBeVisible()
})

test('keeps diagnostics usable on a mobile viewport', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/tools/secs-sml')
  await page.waitForLoadState('networkidle')

  await page.locator('textarea[placeholder="请输入原始日志..."]').fill(malformedSml)
  await page.getByRole('button', { name: '格式化' }).click()

  const panel = page.getByTestId('diagnostics-panel')
  await expect(panel).toBeVisible()
  await expect(panel.locator('.diagnostic-row')).toHaveCount(3)
  await expect(page.locator('.el-loading-mask')).toHaveCount(0)
  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(horizontalOverflow).toBe(false)

  await page.screenshot({ path: testInfo.outputPath('diagnostics-mobile.png'), fullPage: true })
})

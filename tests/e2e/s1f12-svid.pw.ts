import { expect, test } from '@playwright/test'

const malformedS1F12 = `S1F12
<L,1
  <L,2
    <U4 1001>
  >
>.`

test('shows S1F12 diagnostics and selects the related source range', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/tools/s1f12-svid-extractor')
  await page.waitForLoadState('networkidle')

  const source = page.locator('textarea[placeholder="请粘贴 S1F12 报文..."]')
  await source.fill(malformedS1F12)
  await page.getByRole('button', { name: '解析并提取' }).click()

  const diagnostics = page.locator('.svid-diagnostics')
  await expect(diagnostics).toBeVisible()
  await expect(diagnostics.getByText('1 项解析诊断')).toBeVisible()
  await diagnostics.getByText('列表声明 2 项，实际解析到 1 项').click()

  const selection = await source.evaluate((element: HTMLTextAreaElement) => ({
    selected: element.value.slice(element.selectionStart, element.selectionEnd),
    focused: document.activeElement === element
  }))
  expect(selection.focused).toBe(true)
  expect(selection.selected).toContain('<L,2')
  await expect(page.locator('.el-loading-mask')).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath('s1f12-diagnostics.png'), fullPage: true })
})

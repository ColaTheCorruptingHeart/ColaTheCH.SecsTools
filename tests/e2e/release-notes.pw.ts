import { expect, test } from '@playwright/test'

test.use({ storageState: { cookies: [], origins: [] } })

test('shows the latest release once and keeps it manually accessible', async ({ page }) => {
  await page.goto('/home')
  await page.waitForLoadState('networkidle')

  const dialog = page.getByRole('dialog', { name: '版本更新内容' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('SML 解析与日志分析升级')).toBeVisible()
  await expect(dialog.getByText('v0.3.1')).toBeVisible()

  await dialog.getByRole('button', { name: '我知道了' }).click()
  await expect(dialog).toBeHidden()

  await page.reload()
  await page.waitForLoadState('networkidle')
  await expect(dialog).toBeHidden()

  await page.getByRole('button', { name: '查看版本更新' }).click()
  await expect(dialog).toBeVisible()
})

test('shows the release again when the user chooses a later reminder', async ({ page }) => {
  await page.goto('/home')
  await page.waitForLoadState('networkidle')

  const dialog = page.getByRole('dialog', { name: '版本更新内容' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: '稍后提醒' }).click()
  await expect(dialog).toBeHidden()

  await page.reload()
  await page.waitForLoadState('networkidle')
  await expect(dialog).toBeVisible()
})

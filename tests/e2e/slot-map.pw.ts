import { expect, test } from '@playwright/test'

test('supports custom single-digit maps and vertical U1 lists', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/tools/slot-map-converter')
  await page.waitForLoadState('networkidle')

  const slotMap = page.getByTestId('slot-map')
  const invertedSlotMap = page.getByTestId('inverted-slot-map')
  const verticalList = page.getByTestId('vertical-list')
  const invertedVerticalList = page.getByTestId('inverted-vertical-list')

  await expect(slotMap).toHaveValue('0'.repeat(25))
  await expect(invertedSlotMap).toHaveValue('1'.repeat(25))

  await page.getByRole('button', { name: 'Slot 3', exact: true }).click()
  await page.getByRole('button', { name: 'Slot 15', exact: true }).click()
  await page.getByRole('button', { name: 'Slot 25', exact: true }).click()
  await expect(slotMap).toHaveValue('0010000000000010000000001')

  await page.getByTestId('occupied-digit').fill('7')
  await page.getByTestId('empty-digit').fill('2')
  await expect(slotMap).toHaveValue('2272222222222272222222227')
  await expect(invertedSlotMap).toHaveValue('7727777777777727777777772')

  const listLines = (await verticalList.inputValue()).split('\n')
  const invertedListLines = (await invertedVerticalList.inputValue()).split('\n')
  expect(listLines).toHaveLength(27)
  expect(listLines[3]).toBe('    <U1 7>')
  expect(listLines[15]).toBe('    <U1 7>')
  expect(listLines[25]).toBe('    <U1 7>')
  expect(invertedListLines[3]).toBe('    <U1 2>')

  const slotTwoList = `<L,25\n${Array.from({ length: 25 }, (_, index) => `<U1 ${index === 1 ? '7' : '2'}>`).join('\n')}\n>`
  await verticalList.fill(slotTwoList)
  await page.getByRole('button', { name: '应用 List' }).click()
  await expect(page.getByRole('button', { name: 'Slot 2', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Slot 3', exact: true })).toHaveAttribute('aria-pressed', 'false')
  await expect(verticalList).toHaveValue(/<L\n    <U1 2>\n    <U1 7>/)

  await verticalList.fill('<L\n    <U1 7>\n>')
  await page.getByRole('button', { name: '应用 List' }).click()
  await expect(page.getByText('纵向 List 必须包含 25 个 U1 槽位，当前为 1 个')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Slot 2', exact: true })).toHaveAttribute('aria-pressed', 'true')

  const inverseSlotFourList = `<L\n${Array.from({ length: 25 }, (_, index) => `    <U1 ${index === 3 ? '2' : '7'}>`).join('\n')}\n>`
  await invertedVerticalList.fill(inverseSlotFourList)
  await page.getByRole('button', { name: '应用反相 List' }).click()
  await expect(page.getByRole('button', { name: 'Slot 4', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Slot 2', exact: true })).toHaveAttribute('aria-pressed', 'false')

  await page.getByTestId('empty-digit').fill('7')
  await expect(page.getByTestId('empty-digit')).toHaveValue('2')
  await expect(page.getByText('有片值和空槽值不能相同')).toBeVisible()

  await page.screenshot({ path: testInfo.outputPath('slot-map-custom-mapping.png'), fullPage: true })

  await page.setViewportSize({ width: 390, height: 844 })
  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(horizontalOverflow).toBe(false)
})

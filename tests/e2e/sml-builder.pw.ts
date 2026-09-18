import { expect, test } from '@playwright/test'

test('opens the template el-select without a long presentation transition', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 })
  await page.goto('/tools/sml-builder')
  await page.waitForLoadState('networkidle')

  const templateSelect = page.getByTestId('template-select')
  await expect(templateSelect.locator('.el-select__wrapper')).toBeVisible()
  await templateSelect.locator('.el-select__wrapper').click()

  const popper = page.locator('.sml-template-select-popper.el-select__popper')
  await expect(popper).toBeVisible()
  await expect(popper.getByText('S2F41 · Host Command Send')).toBeVisible()
  await expect(popper.getByText('空白报文')).toBeVisible()

  const styles = await page.evaluate(() => {
    const wrapper = document.querySelector('.template-picker .el-select__wrapper')
    const popper = document.querySelector('.sml-template-select-popper.el-select__popper')
    return {
      wrapperTransitionDuration: wrapper ? getComputedStyle(wrapper).transitionDuration : null,
      popperTransitionDuration: popper ? getComputedStyle(popper).transitionDuration : null
    }
  })
  expect(styles.wrapperTransitionDuration).toBe('0s')
  expect(styles.popperTransitionDuration?.split(',').every(duration => duration.trim() === '0s')).toBe(true)
})

test('keeps character lengths and SML source synchronized in both directions', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 })
  await page.goto('/tools/sml-builder')
  await page.waitForLoadState('networkidle')

  const source = page.getByTestId('sml-source-input')
  await expect(source).toHaveValue(/S2F41 W/)
  await expect(page.locator('.selected-node-card')).toContainText('RCMD')

  const typeMetrics = await page.locator('select.inline-type').evaluateAll(elements => elements.map(element => {
    const select = element as HTMLSelectElement
    return {
      type: select.value,
      width: select.getBoundingClientRect().width,
      clipped: select.scrollWidth > select.clientWidth
    }
  }))
  const asciiWidths = typeMetrics.filter(item => item.type === 'A').map(item => item.width)
  expect(new Set(asciiWidths).size).toBe(1)
  expect(typeMetrics.every(item => !item.clipped)).toBe(true)
  expect(typeMetrics.find(item => item.type === 'BOOLEAN')!.width).toBeGreaterThan(asciiWidths[0]!)

  const rcmdLength = page.getByLabel('[0][0] 字符长度', { exact: true })
  await rcmdLength.fill('8')
  await expect(source).toHaveValue(/<A \[8\] "START {3}">/)

  await rcmdLength.fill('4')
  await expect(page.getByText('RCMD 当前 5 个字符，超过声明长度 4')).toBeVisible()

  await source.fill(`S9F1 W
<L [1]
  <A [5] 'OK'>
>.`)
  await expect(page.getByText('等待同步', { exact: true })).toBeVisible()
  await page.waitForTimeout(500)
  await expect(page.getByLabel('Stream')).toHaveValue('2')
  await source.blur()
  await expect(page.getByText('已同步', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Stream')).toHaveValue('9')
  await expect(page.getByLabel('Function')).toHaveValue('1')
  await expect(page.getByLabel('[0][0] 字符长度', { exact: true })).toHaveValue('5')
  await expect(page.getByLabel('[0][0] 节点值', { exact: true })).toHaveValue('OK')
  await expect(source).toHaveValue(/<A \[5\] "OK {3}">/)

  await page.getByLabel('[0][0] 节点值', { exact: true }).fill('HEY')
  await expect(source).toHaveValue(/<A \[5\] "HEY {2}">/)

  await source.fill('S9F1 W\n<L')
  await expect(page.getByText('等待同步', { exact: true })).toBeVisible()
  await source.blur()
  await expect(page.getByText('解析失败', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Stream')).toHaveValue('9')
})

test('edits S2F41 nodes directly on the SML canvas', async ({ page, context }, testInfo) => {
  const pageErrors: string[] = []
  page.on('pageerror', error => pageErrors.push(error.message))
  page.on('console', message => {
    if (message.type() === 'error') pageErrors.push(message.text())
  })

  await page.setViewportSize({ width: 1600, height: 1000 })
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'http://127.0.0.1:63897' })
  await page.goto('/tools/sml-builder')
  await page.waitForLoadState('networkidle')

  await expect(page.getByRole('heading', { name: 'SML 构造器' })).toBeVisible()
  const canvas = page.getByTestId('sml-canvas')
  await expect(page.getByLabel('Stream')).toHaveValue('2')
  await expect(page.getByLabel('Function')).toHaveValue('41')
  await expect(canvas).toContainText('[3]')
  await expect(page.getByText('结构有效 · 12 个节点')).toBeVisible()

  await page.getByRole('button', { name: '引号设置' }).click()
  await page.getByTestId('numeric-quote-select').locator('.el-select__wrapper').click()
  await page.locator('.sml-quote-select-popper.el-select__popper:visible').getByRole('option', { name: "单引号 ' '" }).click()
  await page.getByTestId('text-quote-select').locator('.el-select__wrapper').click()
  await page.locator('.sml-quote-select-popper.el-select__popper:visible').getByRole('option', { name: "单引号 ' '" }).click()
  await page.getByRole('heading', { name: 'SML 构造器' }).click()
  const rcmdLineText = await page.getByLabel('[0][0] 节点值', { exact: true }).evaluate(element => element.closest('.sml-line')?.textContent || '')
  const portLineText = await page.getByLabel('[0][1][1][1] 节点值', { exact: true }).evaluate(element => element.closest('.sml-line')?.textContent || '')
  expect(rcmdLineText).toContain("'")
  expect(portLineText).toContain("'")
  await page.getByRole('button', { name: '复制 SML' }).click()
  const clipboardText = await page.evaluate(() => navigator.clipboard.readText())
  expect(clipboardText).toContain("\n    <A 'START'>")
  expect(clipboardText).not.toContain('<L [')

  await page.getByLabel('[0][1][1][1] 节点值').fill('300')
  await expect(page.getByText('1 个错误 · 0 个提醒')).toBeVisible()
  await expect(page.getByLabel('[0][1][1][1] 节点值')).toHaveValue('300')

  await page.getByLabel('[0][1][1][1] 节点值').fill('2')
  await page.getByLabel('[0][1][0] 节点名称').click({ button: 'right' })
  await page.getByRole('menu', { name: '节点操作' }).getByRole('menuitem', { name: /复制节点/ }).click()
  await expect(canvas).toContainText('[4]')
  await page.getByLabel('[0][1][1][0] 节点值').fill('LOTID')
  await page.getByLabel('[0][1][1][1] 节点值').fill('LOT-001')
  await expect(page.getByText('结构有效 · 15 个节点')).toBeVisible()

  await page.getByLabel('[0][1][2][1] 数据类型').selectOption('U2')
  await expect(page.getByLabel('[0][1][2][1] 数据类型')).toHaveValue('U2')
  await page.getByLabel('[0][1][2][1] 节点值').fill('2')

  await page.getByLabel('[0][1][1][1] 节点值').click({ button: 'right' })
  await page.getByRole('menu', { name: '节点操作' }).getByRole('menuitem', { name: '包装为 List' }).click()
  await expect(page.getByLabel('[0][1][1][1] 数据类型')).toHaveValue('L')
  await expect(canvas).toContainText('[1]')
  await page.getByLabel('[0][1][1][1] 节点名称').click({ button: 'right' })
  await page.getByRole('menu', { name: '节点操作' }).getByRole('menuitem', { name: /添加子节点/ }).click()
  await expect(canvas).toContainText('[2]')

  await page.keyboard.press('Control+d')
  await expect(canvas).toContainText('[3]')
  await expect(page.getByText('结构有效 · 18 个节点')).toBeVisible()

  await page.screenshot({ path: testInfo.outputPath('sml-builder-demo.png'), fullPage: true })
  expect(pageErrors).toEqual([])
})

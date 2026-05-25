<template>
  <div class="h-full min-h-0">
    <div class="flex h-full min-h-0 flex-col gap-3">
      <div class="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3">
        <div class="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
          <div class="flex items-center gap-2">
            <div class="p-1.5 bg-teal-50 rounded-lg">
              <el-icon class="text-teal-600 text-lg"><EditPen /></el-icon>
            </div>
            <div>
              <h2 class="text-lg font-semibold text-slate-800 m-0">S1F3 生成器</h2>
              <p class="text-xs text-slate-500 m-0 mt-0.5">支持导入 S1F12 导出的 SVID 表格，或手动粘贴 SVID 列表后生成 S1F3 命令</p>
            </div>
          </div>

          <div class="w-full xl:w-auto flex flex-wrap items-center gap-2 rounded-xl bg-slate-50/80 p-2">
            <div class="flex items-center gap-2 rounded-md  px-2 py-1 shrink-0 whitespace-nowrap">
              <span class="text-xs text-slate-600">数据格式</span>
              <el-input v-model="dataFormat" size="small" class="shrink-0" style="width: 2.5rem" placeholder="U4" />
            </div>
            <el-button size="small" type="primary" class="!rounded-md" @click="parseInput">生成S1F3</el-button>
            <el-button size="small" class="!rounded-md" @click="triggerImport">导入 CSV</el-button>
            <el-button size="small" class="!rounded-md" :disabled="!commandText" @click="copyCommand">复制命令</el-button>
            <el-button size="small" class="!rounded-md" :disabled="!commandBodyText" @click="copyCommandBody">仅复制Body</el-button>
            <el-button size="small" type="danger" plain class="!rounded-md" @click="clearAll">清空</el-button>
            <input ref="fileInputRef" type="file" class="hidden" accept=".csv,.txt" @change="handleFileImport" />
          </div>
        </div>
      </div>

      <div class="grid flex-1 min-h-0 grid-cols-1 gap-3 xl:grid-cols-[minmax(290px,0.98fr)_minmax(320px,0.82fr)_minmax(340px,1.08fr)]">
      <div class="bg-white rounded-xl border border-slate-200 shadow-sm flex min-h-[320px] flex-col overflow-hidden xl:min-h-0">
        <div class="bg-slate-50 border-b border-slate-200 px-3 py-2 flex items-center justify-between gap-3">
          <span class="text-sm font-medium text-slate-600 whitespace-nowrap shrink-0">SVID生成</span>
          <div class="flex items-center justify-end shrink-0 min-w-0">
            <div class="flex items-center gap-2 shrink-0 whitespace-nowrap rounded-lg ">
              <span class="text-xs text-slate-500 shrink-0">回填方式</span>
              <el-select v-model="generatedInputWriteMode" size="small" class="shrink-0 generated-mode-select">
                <el-option label="覆盖" value="overwrite" />
                <el-option label="追加" value="append" />
              </el-select>
            </div>
          </div>
        </div>

        <div class="flex-1 overflow-auto p-3 flex flex-col">
          <div class="pb-3">
            <div class="flex items-center justify-between gap-2 mb-2">
              <span class="text-sm font-medium text-slate-700">区间生成</span>
              <span class="text-xs text-slate-400">按闭区间生成</span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-end">
              <div>
                <div class="text-[11px] text-slate-500 mb-1">起始值</div>
                <el-input v-model="rangeStart" size="small" placeholder="1001 / 3E9" />
              </div>
              <div>
                <div class="text-[11px] text-slate-500 mb-1">步长</div>
                <el-input v-model="rangeStep" size="small" placeholder="1 / A" />
              </div>
              <div>
                <div class="text-[11px] text-slate-500 mb-1">结束值</div>
                <el-input v-model="rangeEnd" size="small" placeholder="1020 / 3FC" />
              </div>
            </div>

            <div class="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-end">
              <div>
                <div class="text-[11px] text-slate-500 mb-1">进制</div>
                <el-select v-model="rangeRadix" size="small" class="w-full">
                  <el-option label="10进制" value="10" />
                  <el-option label="16进制" value="16" />
                </el-select>
              </div>
              <el-button size="small" type="primary" class="!rounded-md w-full" @click="generateRangeSvids">生成区间列表</el-button>
            </div>
          </div>

          <div class="border-t border-slate-200 pt-3">
            <div class="flex items-center justify-between gap-2 mb-2">
              <span class="text-sm font-medium text-slate-700">规则生成</span>
              <span class="text-xs text-slate-400">普通递增或模板占位</span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <div class="text-[11px] text-slate-500 mb-1">模板</div>
                <el-input v-model="sequencePattern" size="small" placeholder="留空或 10**1" />
              </div>
              <div>
                <div class="text-[11px] text-slate-500 mb-1">起始值</div>
                <el-input v-model="sequenceStart" size="small" placeholder="1 / A" />
              </div>
              <div>
                <div class="text-[11px] text-slate-500 mb-1">递增数量</div>
                <el-input v-model="sequenceCount" size="small" placeholder="3" />
              </div>
              <div>
                <div class="text-[11px] text-slate-500 mb-1">步长</div>
                <el-input v-model="sequenceStep" size="small" placeholder="2 / F" />
              </div>
              <div>
                <div class="text-[11px] text-slate-500 mb-1">进制</div>
                <el-select v-model="sequenceRadix" size="small" class="w-full">
                  <el-option label="10进制" value="10" />
                  <el-option label="16进制" value="16" />
                </el-select>
              </div>
              <div class="flex items-end">
                <el-button size="small" type="primary" class="!rounded-md w-full" @click="generateSequenceSvids">生成规则列表</el-button>
              </div>
            </div>

            <div class="mt-2 text-[11px] text-slate-500 leading-4.5">
              模板中的 * 只能出现一次且必须连续；有几个 *，生成段就有几位。
            </div>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-xl border border-slate-200 shadow-sm flex min-h-[360px] flex-col overflow-hidden xl:min-h-0">
        <div class="bg-slate-50 border-b border-slate-200 px-3 py-2 flex items-center justify-between gap-2">
          <span class="text-sm font-medium text-slate-600">SVID 输入区</span>
          <el-button size="small" class="!rounded-md" :disabled="!rawInput.trim()" @click="convertHexInputToDecimal">16进制转10进制</el-button>
        </div>

        <div class="flex-1 overflow-hidden relative">
          <el-input
            v-model="rawInput"
            type="textarea"
            class="code-input w-full h-full absolute inset-0"
            placeholder="示例：&#10;22208&#10;22209&#10;&#10;"
            resize="none"
          />
        </div>
      </div>

      <div class="bg-white rounded-xl border border-slate-200 shadow-sm flex min-h-[320px] flex-col overflow-hidden xl:min-h-0">
        <div class="bg-slate-50 border-b border-slate-200 px-3 py-2 flex flex-col gap-2">
          <div class="flex items-center justify-between gap-2">
            <span class="text-sm font-medium text-slate-600">S1F3 命令结果</span>
          </div>
        </div>

        <div class="flex-1 overflow-hidden relative bg-slate-50/30">
          <el-input
            :model-value="commandText"
            type="textarea"
            class="code-input w-full h-full absolute inset-0"
            resize="none"
            readonly
            placeholder="生成结果将在这里显示..."
          />
        </div>
      </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { EditPen } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

const rawInput = ref('')
const dataFormat = ref('U4')
const appliedDataFormat = ref('U4')
const fileInputRef = ref<HTMLInputElement | null>(null)
const commandText = ref('')
const commandBodyText = ref('')
const rangeStart = ref('')
const rangeStep = ref('1')
const rangeEnd = ref('')
const rangeRadix = ref<'10' | '16'>('10')
const sequencePattern = ref('')
const sequenceStart = ref('')
const sequenceCount = ref('')
const sequenceStep = ref('1')
const sequenceRadix = ref<'10' | '16'>('10')
const generatedInputWriteMode = ref<'overwrite' | 'append'>('overwrite')

const MAX_GENERATED_ITEMS = 5000

type SupportedRadix = 10 | 16

function escapeCommandValue(value: string) {
  return value.replace(/"/g, '\\"')
}

function stripWrappingQuotes(value: string) {
  const trimmed = value.trim()
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

function parseDelimitedLine(line: string, delimiter: string) {
  const cells: string[] = []
  let current = ''
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]

    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === delimiter && !inQuotes) {
      cells.push(current)
      current = ''
      continue
    }

    current += char
  }

  cells.push(current)
  return cells.map(cell => stripWrappingQuotes(cell))
}

function isNumeric(value: string) {
  return /^\d+$/.test(value.trim())
}

function normalizeRadix(value: '10' | '16'): SupportedRadix {
  return value === '16' ? 16 : 10
}

function isValidDigitsForRadix(value: string, radix: SupportedRadix) {
  const pattern = radix === 16 ? /^[0-9a-fA-F]+$/ : /^\d+$/
  return pattern.test(value)
}

function parseRadixValue(rawValue: string, radix: SupportedRadix, label: string) {
  const trimmed = rawValue.trim()
  if (!trimmed) {
    ElMessage.warning(`请输入${label}`)
    return null
  }

  if (!isValidDigitsForRadix(trimmed, radix)) {
    ElMessage.warning(`${label}不是有效的${radix}进制整数`)
    return null
  }

  const parsed = Number.parseInt(trimmed, radix)
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    ElMessage.warning(`${label}必须是非负整数`)
    return null
  }

  return parsed
}

function parsePositiveRadixValue(rawValue: string, radix: SupportedRadix, label: string) {
  const parsed = parseRadixValue(rawValue, radix, label)
  if (parsed === null) {
    return null
  }

  if (parsed <= 0) {
    ElMessage.warning(`${label}必须是正整数`)
    return null
  }

  return parsed
}

function formatRadixValue(value: number, radix: SupportedRadix) {
  return value.toString(radix).toUpperCase()
}

function extractWildcardBlock(pattern: string) {
  const matches = [...pattern.matchAll(/\*+/g)]
  if (!matches.length) {
    return null
  }

  if (matches.length > 1) {
    ElMessage.warning('模板中的 * 只能出现一次且必须连续')
    return false
  }

  const match = matches[0]
  if (!match) {
    return false
  }

  return {
    start: match.index ?? 0,
    length: match[0].length,
  }
}

function isValidPatternForRadix(pattern: string, radix: SupportedRadix) {
  const fixedPart = pattern.replace(/\*/g, '')
  if (!fixedPart) {
    return true
  }

  return isValidDigitsForRadix(fixedPart, radix)
}

function buildSequenceValue(pattern: string, value: number, radix: SupportedRadix) {
  const trimmedPattern = pattern.trim()
  if (!trimmedPattern) {
    return formatRadixValue(value, radix)
  }

  if (!isValidPatternForRadix(trimmedPattern, radix)) {
    ElMessage.warning(`模板不是有效的${radix}进制格式`)
    return null
  }

  const wildcardBlock = extractWildcardBlock(trimmedPattern)
  if (wildcardBlock === false) {
    return null
  }

  if (!wildcardBlock) {
    ElMessage.warning('模板非空时必须包含一段连续的 * 占位符；留空则按普通递增生成')
    return null
  }

  const formattedValue = formatRadixValue(value, radix)
  if (formattedValue.length > wildcardBlock.length) {
    ElMessage.warning(`模板 ${trimmedPattern} 的占位位数不足，无法写入 ${formattedValue}`)
    return null
  }

  const paddedValue = formattedValue.padStart(wildcardBlock.length, '0')
  return `${trimmedPattern.slice(0, wildcardBlock.start)}${paddedValue}${trimmedPattern.slice(wildcardBlock.start + wildcardBlock.length)}`
}

function fillGeneratedInput(values: string[], successMessage: string) {
  const nextText = values.join('\n')
  const existingText = rawInput.value.replace(/\s+$/, '')

  if (generatedInputWriteMode.value === 'append' && existingText.trim()) {
    rawInput.value = `${existingText}\n${nextText}`
    ElMessage.success(`${successMessage}，并已追加到输入区`)
    return
  }

  rawInput.value = nextText
  ElMessage.success(successMessage)
}

function convertHexInputToDecimal() {
  if (!rawInput.value.trim()) {
    ElMessage.warning('请先输入或粘贴 SVID 列表')
    return
  }

  const rows = buildRowsFromLines(rawInput.value)
  if (!rows.length) {
    ElMessage.warning('未识别到可转换的 SVID 数据')
    return
  }

  const convertedValues: string[] = []

  for (const row of rows) {
    const normalizedHexValue = row.svid.trim().replace(/^0x/i, '')
    const parsedValue = parseRadixValue(normalizedHexValue, 16, `第 ${row.index} 条 SVID`)

    if (parsedValue === null) {
      return
    }

    convertedValues.push(String(parsedValue))
  }

  rawInput.value = convertedValues.join('\n')
  applyDataFormat()
  updateCommandResult(convertedValues)
  ElMessage.success(`已将 ${convertedValues.length} 条 SVID 从 16 进制转换为 10 进制`)
}

function buildRowsFromLines(text: string) {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  if (!lines.length) {
    return []
  }

  const delimiter = lines.some(line => line.includes('\t')) ? '\t' : ','
  const parsedLines = lines.map(line => parseDelimitedLine(line, delimiter))
  const header = parsedLines[0]?.map(cell => cell.trim().toUpperCase()) || []
  const svidHeaderIndex = header.findIndex(cell => cell === 'SVID')
  const svnameHeaderIndex = header.findIndex(cell => cell === 'SVNAME')
  const hasHeader = svidHeaderIndex >= 0 || header.includes('序号'.toUpperCase())
  const dataLines = hasHeader ? parsedLines.slice(1) : parsedLines

  return dataLines
    .map((cells, index) => {
      let svid = ''
      let svname = ''
      const firstCell = cells[0] || ''

      if (hasHeader && svidHeaderIndex >= 0) {
        svid = cells[svidHeaderIndex] || ''
        svname = svnameHeaderIndex >= 0 ? (cells[svnameHeaderIndex] || '') : ''
      } else if (cells.length === 1) {
        svid = firstCell
      } else if (cells.length >= 3 && isNumeric(firstCell)) {
        svid = cells[1] || ''
        svname = cells[2] || ''
      } else {
        svid = firstCell
        svname = cells[1] || ''
      }

      return {
        index: index + 1,
        svid: svid.trim(),
        svname: svname.trim(),
      }
    })
    .filter(row => row.svid)
}

function applyDataFormat() {
  appliedDataFormat.value = dataFormat.value.trim() || 'U4'
}

function updateCommandResult(svidValues: string[]) {
  if (!svidValues.length) {
    commandText.value = ''
    commandBodyText.value = ''
    return
  }

  const normalizedFormat = appliedDataFormat.value.trim() || 'U4'
  const bodyLines = svidValues.map(value => `    <${normalizedFormat} "${escapeCommandValue(value)}">`)

  commandBodyText.value = bodyLines.join('\n')
  commandText.value = [
    'S1F3 W',
    '<L',
    ...bodyLines,
    '>.',
  ].join('\n')
}

function generateRangeSvids() {
  const radix = normalizeRadix(rangeRadix.value)
  const startValue = parseRadixValue(rangeStart.value, radix, '起始值')
  const stepValue = parseRadixValue(rangeStep.value, radix, '步长')
  const endValue = parseRadixValue(rangeEnd.value, radix, '结束值')

  if (startValue === null || stepValue === null || endValue === null) {
    return
  }

  if (stepValue <= 0) {
    ElMessage.warning('步长必须是正整数')
    return
  }

  if (startValue > endValue) {
    ElMessage.warning('结束值必须大于或等于起始值')
    return
  }

  const total = Math.floor((endValue - startValue) / stepValue) + 1
  if (total > MAX_GENERATED_ITEMS) {
    ElMessage.warning(`单次最多生成 ${MAX_GENERATED_ITEMS} 条 SVID`)
    return
  }

  const values = Array.from({ length: total }, (_, index) => formatRadixValue(startValue + stepValue * index, radix))
  fillGeneratedInput(values, `已生成 ${values.length} 条区间 SVID`)
}

function generateSequenceSvids() {
  const radix = normalizeRadix(sequenceRadix.value)
  const startValue = parseRadixValue(sequenceStart.value, radix, '起始值')
  const stepValue = parseRadixValue(sequenceStep.value, radix, '步长')
  const countValue = parsePositiveRadixValue(sequenceCount.value, radix, '递增数量')

  if (startValue === null || stepValue === null || countValue === null) {
    return
  }

  if (stepValue <= 0) {
    ElMessage.warning('步长必须是正整数')
    return
  }

  if (countValue > MAX_GENERATED_ITEMS) {
    ElMessage.warning(`单次最多生成 ${MAX_GENERATED_ITEMS} 条 SVID`)
    return
  }

  const values: string[] = []

  for (let index = 0; index < countValue; index += 1) {
    const currentValue = startValue + stepValue * index
    const builtValue = buildSequenceValue(sequencePattern.value, currentValue, radix)

    if (builtValue === null) {
      return
    }

    values.push(builtValue)
  }

  fillGeneratedInput(values, `已生成 ${values.length} 条规则 SVID`)
}

function parseInput() {
  if (!rawInput.value.trim()) {
    ElMessage.warning('请先输入或粘贴 SVID 列表')
    return
  }

  const rows = buildRowsFromLines(rawInput.value)
  applyDataFormat()

  if (!rows.length) {
    updateCommandResult([])
    ElMessage.warning('未识别到有效的 SVID 数据')
    return
  }

  updateCommandResult(rows.map(row => row.svid.trim()).filter(Boolean))

  ElMessage.success(`已生成 ${rows.length} 条 SVID 命令`)
}

function triggerImport() {
  fileInputRef.value?.click()
}

async function handleFileImport(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) {
    return
  }

  try {
    const text = await file.text()
    rawInput.value = text
    const rows = buildRowsFromLines(text)
    applyDataFormat()

    if (!rows.length) {
      updateCommandResult([])
      ElMessage.warning('文件中未识别到有效的 SVID 数据')
    } else {
      updateCommandResult(rows.map(row => row.svid.trim()).filter(Boolean))
      ElMessage.success(`已从文件导入并生成 ${rows.length} 条 SVID 命令`)
    }
  } catch (error) {
    console.error('Failed to import SVID file', error)
    ElMessage.error('导入文件失败')
  } finally {
    input.value = ''
  }
}

async function copyCommand() {
  if (!commandText.value) {
    ElMessage.warning('当前没有可复制的命令')
    return
  }

  try {
    await navigator.clipboard.writeText(commandText.value)
    ElMessage.success('命令已复制')
  } catch {
    ElMessage.error('复制失败，请手动复制')
  }
}

async function copyCommandBody() {
  if (!commandBodyText.value) {
    ElMessage.warning('当前没有可复制的 Body')
    return
  }

  try {
    await navigator.clipboard.writeText(commandBodyText.value)
    ElMessage.success('Body 已复制')
  } catch {
    ElMessage.error('复制失败，请手动复制')
  }
}

function clearAll() {
  rawInput.value = ''
  dataFormat.value = 'U4'
  appliedDataFormat.value = 'U4'
  commandText.value = ''
  commandBodyText.value = ''
  rangeStart.value = ''
  rangeStep.value = '1'
  rangeEnd.value = ''
  rangeRadix.value = '10'
  sequencePattern.value = ''
  sequenceStart.value = ''
  sequenceCount.value = ''
  sequenceStep.value = '1'
  sequenceRadix.value = '10'
  generatedInputWriteMode.value = 'overwrite'
  if (fileInputRef.value) {
    fileInputRef.value.value = ''
  }
}
</script>

<style scoped>
.code-input :deep(.el-textarea__inner) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  height: 100% !important;
  border: none !important;
  box-shadow: none !important;
  padding: 1rem;
  font-size: 14px;
  line-height: 1.6;
  background-color: transparent !important;
}

.code-input :deep(.el-textarea__inner:focus) {
  box-shadow: none !important;
}

.generated-mode-select {
  width: 5.25rem;
}

.generated-mode-select :deep(.el-select__wrapper) {
  min-height: 1.75rem;
}

.generated-mode-select :deep(.el-select__selected-item),
.generated-mode-select :deep(.el-select__placeholder) {
  white-space: nowrap;
}
</style>

<template>
  <div class="h-full flex flex-col gap-4" v-loading="loading" :element-loading-text="loadingText">
    <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div class="flex items-center gap-2">
          <div class="p-2 bg-teal-50 rounded-lg">
            <el-icon class="text-teal-600 text-xl"><Document /></el-icon>
          </div>
          <div>
            <h2 class="text-lg font-semibold text-slate-800 m-0">S1F4 解析</h2>
            <p class="text-xs text-slate-500 m-0 mt-0.5">按 SVNAME 的顺序解析 S1F4 报文，并把每个 Value 映射到对应的 SVNAME</p>
          </div>
        </div>

        <div class="flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border border-slate-100 flex-wrap">
          <el-button size="small" type="primary" class="!rounded-md shadow-sm" :loading="loading" :disabled="loading" @click="handleParse">解析并匹配</el-button>
          <div class="w-px h-4 bg-slate-300 mx-1"></div>
          <el-button size="small" type="danger" plain class="!rounded-md" :disabled="loading" @click="clearAll">清空</el-button>
        </div>
      </div>
    </div>

    <div class="flex-1 grid grid-cols-1 xl:grid-cols-[minmax(0,3fr)_minmax(0,3fr)_minmax(0,4fr)] gap-4 min-h-0">
      <div class="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
        <div class="bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center justify-between gap-2">
          <span class="text-sm font-medium text-slate-600">SVNAME列表</span>
        </div>
        <div class="flex-1 overflow-hidden relative">
          <textarea
            ref="mappingTextareaRef"
            class="source-textarea w-full h-full absolute inset-0"
            placeholder="示例：&#10;communication state&#10;secs control state&#10;..."
            :disabled="loading"
            spellcheck="false"
          />
        </div>
      </div>

      <div class="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
        <div class="bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center justify-between gap-2">
          <span class="text-sm font-medium text-slate-600">S1F4 报文</span>
        </div>
        <div class="flex-1 overflow-hidden relative">
          <textarea
            ref="messageTextareaRef"
            class="source-textarea w-full h-full absolute inset-0"
            placeholder="请粘贴 S1F4 报文..."
            :disabled="loading"
            spellcheck="false"
          />
        </div>
      </div>

      <div class="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
        <div class="bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center justify-between gap-2 flex-wrap">
          <span class="text-sm font-medium text-slate-600">映射结果</span>
          <div class="flex items-center gap-2 flex-wrap">
            <el-tag size="small" type="info" round>SVNAME {{ mappingNames.length }}</el-tag>
            <el-tag size="small" type="success" round>Value {{ valueItems.length }}</el-tag>
            <el-tag size="small" type="warning" round>结果 {{ rows.length }}</el-tag>
          </div>
        </div>

        <div class="flex-1 overflow-hidden">
          <div v-if="rows.length" class="h-full">
            <el-auto-resizer>
              <template #default="{ width, height }">
                <el-table-v2
                  :columns="buildColumns(width)"
                  :data="rows"
                  :width="width"
                  :height="height"
                  :header-height="40"
                  :row-height="44"
                  fixed
                  class="parser-virtual-table"
                />
              </template>
            </el-auto-resizer>
          </div>
          <div v-else class="h-full flex items-center justify-center">
            <el-empty description="暂无匹配结果" :image-size="60" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { h, nextTick, ref } from 'vue'
import { Document } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { getNodeValueText, parseSmlTree, type SecsSmlNode } from './secsSml'

interface ParsedValueItem {
  dataType: string
  value: string
}

interface ResultRow {
  index: number
  svname: string
  value: string
  dataType: string
}

const mappingTextareaRef = ref<HTMLTextAreaElement | null>(null)
const messageTextareaRef = ref<HTMLTextAreaElement | null>(null)
const mappingNames = ref<string[]>([])
const valueItems = ref<ParsedValueItem[]>([])
const rows = ref<ResultRow[]>([])
const loading = ref(false)
const loadingText = '正在解析 S1F4 报文，请稍候...'

const columnMinWidths = {
  index: 76,
  svname: 220,
  value: 220,
  dataType: 120
} as const

const columnWeights = {
  index: 0.1,
  svname: 0.34,
  value: 0.36,
  dataType: 0.2
} as const

function getMappingText() {
  return mappingTextareaRef.value?.value ?? ''
}

function getMessageText() {
  return messageTextareaRef.value?.value ?? ''
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

function parseSvnameMappings(text: string) {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  if (!lines.length) {
    return []
  }

  const delimiter = lines.some(line => line.includes('\t')) ? '\t' : ','
  const parsedLines = lines.map(line => parseDelimitedLine(line, delimiter))
  const header = parsedLines[0]?.map(cell => cell.trim().toUpperCase()) || []
  const svnameHeaderIndex = header.findIndex(cell => cell === 'SVNAME')
  const hasHeader = svnameHeaderIndex >= 0 || header.includes('序号'.toUpperCase()) || header.includes('SVID')
  const dataLines = hasHeader ? parsedLines.slice(1) : parsedLines

  return dataLines
    .map(cells => {
      const firstCell = cells[0] || ''

      if (hasHeader && svnameHeaderIndex >= 0) {
        return (cells[svnameHeaderIndex] || '').trim()
      }

      if (cells.length === 1) {
        return firstCell.trim()
      }

      if (isNumeric(firstCell)) {
        return (cells[2] || cells[1] || '').trim()
      }

      return firstCell.trim()
    })
    .filter(Boolean)
}

function getNodeType(node: SecsSmlNode | undefined) {
  if (!node) return ''
  const match = node.text.match(/^<([^\s>]+)/)
  return match?.[1] || ''
}

function serializeNode(node: SecsSmlNode | undefined): string {
  if (!node) return ''

  if (!node.children.length) {
    return node.text
  }

  return [node.text, ...node.children.map(child => serializeNode(child)), '>'].filter(Boolean).join(' ')
}

function normalizeNodeValue(node: SecsSmlNode | undefined) {
  if (!node) return ''

  if (!node.children.length) {
    const rawValue = getNodeValueText(node)
    return rawValue ? stripWrappingQuotes(rawValue) : ''
  }

  return serializeNode(node)
}

function extractS1F4Values(text: string) {
  const parsed = parseSmlTree(text)
  const rootNode = parsed.roots[0]
  if (!rootNode) {
    return []
  }

  const targetNodes = rootNode.children.length ? rootNode.children : [rootNode]

  return targetNodes.map(node => ({
    dataType: getNodeType(node),
    value: normalizeNodeValue(node)
  }))
}

function buildResultRows(svnames: string[], values: ParsedValueItem[]) {
  const maxLength = Math.max(svnames.length, values.length)
  return Array.from({ length: maxLength }, (_, index) => ({
    index: index + 1,
    svname: svnames[index] || '',
    value: values[index]?.value || '',
    dataType: values[index]?.dataType || ''
  }))
}

function createTextCell(className: string) {
  return ({ cellData }: { cellData: string | number }) => h('div', { class: className }, String(cellData ?? ''))
}

function buildColumns(containerWidth: number) {
  const safeWidth = Math.max(containerWidth, 0)
  const totalMinWidth = Object.values(columnMinWidths).reduce((sum, width) => sum + width, 0)

  const resolveWidth = (key: keyof typeof columnMinWidths) => {
    const minWidth = columnMinWidths[key]
    return Math.max(minWidth, Math.round(safeWidth * columnWeights[key]))
  }

  if (safeWidth < totalMinWidth) {
    return [
      {
        key: 'index',
        dataKey: 'index',
        title: '序号',
        width: columnMinWidths.index,
        align: 'center',
        cellRenderer: createTextCell('table-cell table-cell-center')
      },
      {
        key: 'svname',
        dataKey: 'svname',
        title: 'SVNAME',
        width: columnMinWidths.svname,
        cellRenderer: createTextCell('table-cell')
      },
      {
        key: 'value',
        dataKey: 'value',
        title: 'Value',
        width: columnMinWidths.value,
        cellRenderer: createTextCell('table-cell')
      },
      {
        key: 'dataType',
        dataKey: 'dataType',
        title: '数据类型',
        width: columnMinWidths.dataType,
        cellRenderer: createTextCell('table-cell')
      }
    ]
  }

  return [
    {
      key: 'index',
      dataKey: 'index',
      title: '序号',
      width: resolveWidth('index'),
      align: 'center',
      cellRenderer: createTextCell('table-cell table-cell-center')
    },
    {
      key: 'svname',
      dataKey: 'svname',
      title: 'SVNAME',
      width: resolveWidth('svname'),
      cellRenderer: createTextCell('table-cell')
    },
    {
      key: 'value',
      dataKey: 'value',
      title: 'Value',
      width: resolveWidth('value'),
      cellRenderer: createTextCell('table-cell')
    },
    {
      key: 'dataType',
      dataKey: 'dataType',
      title: '数据类型',
      width: resolveWidth('dataType'),
      cellRenderer: createTextCell('table-cell')
    }
  ]
}

async function handleParse() {
  const mappingText = getMappingText()
  const messageText = getMessageText()

  if (!mappingText.trim()) {
    ElMessage.warning('请先输入 SVNAME 映射')
    return
  }

  if (!messageText.trim()) {
    ElMessage.warning('请先粘贴 S1F4 报文')
    return
  }

  if (loading.value) return

  loading.value = true
  rows.value = []

  try {
    await nextTick()
    const parsedMappings = parseSvnameMappings(mappingText)
    const parsedValues = extractS1F4Values(messageText)

    mappingNames.value = parsedMappings
    valueItems.value = parsedValues
    rows.value = buildResultRows(parsedMappings, parsedValues)

    if (!rows.value.length) {
      ElMessage.warning('未识别到可匹配的数据，请确认映射和报文结构')
      return
    }

    if (parsedMappings.length !== parsedValues.length) {
      ElMessage.warning(`匹配完成，但数量不一致：SVNAME ${parsedMappings.length} 条，Value ${parsedValues.length} 条`)
      return
    }

    ElMessage.success(`解析完成，共匹配 ${rows.value.length} 条`)
  } catch (error) {
    rows.value = []
    mappingNames.value = []
    valueItems.value = []
    ElMessage.error(error instanceof Error ? error.message : '解析失败，请检查输入内容')
  } finally {
    loading.value = false
  }
}

function clearAll() {
  if (loading.value) return

  if (mappingTextareaRef.value) {
    mappingTextareaRef.value.value = ''
  }

  if (messageTextareaRef.value) {
    messageTextareaRef.value.value = ''
  }

  mappingNames.value = []
  valueItems.value = []
  rows.value = []
}
</script>

<style scoped>
.source-textarea {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  height: 100%;
  width: 100%;
  border: none;
  outline: none;
  padding: 1rem;
  font-size: 14px;
  line-height: 1.6;
  background-color: transparent;
  resize: none;
}

.source-textarea:disabled {
  cursor: not-allowed;
  color: rgb(100 116 139);
  background-color: rgb(248 250 252 / 0.7);
}

.parser-virtual-table :deep(.el-table-v2__header-cell),
.parser-virtual-table :deep(.el-table-v2__row-cell) {
  border-bottom: 1px solid rgb(226 232 240);
  border-right: 1px solid rgb(226 232 240);
}

.parser-virtual-table :deep(.el-table-v2__header-cell) {
  background: rgb(248 250 252);
  color: rgb(71 85 105);
  font-weight: 500;
}

.parser-virtual-table :deep(.el-table-v2__row-cell) {
  background: rgb(255 255 255);
}

.parser-virtual-table :deep(.el-table-v2__row:hover .el-table-v2__row-cell) {
  background: rgb(248 250 252);
}

.table-cell {
  display: flex;
  align-items: center;
  height: 100%;
  width: 100%;
  padding: 0 8px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.table-cell-center {
  justify-content: center;
}
</style>

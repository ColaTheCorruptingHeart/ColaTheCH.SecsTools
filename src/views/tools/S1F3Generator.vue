<template>
  <div class="h-full flex flex-col gap-4">
    <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div class="flex items-center gap-2">
          <div class="p-2 bg-teal-50 rounded-lg">
            <el-icon class="text-teal-600 text-xl"><EditPen /></el-icon>
          </div>
          <div>
            <h2 class="text-lg font-semibold text-slate-800 m-0">S1F3 生成器</h2>
            <p class="text-xs text-slate-500 m-0 mt-0.5">支持导入 S1F12 导出的 SVID 表格，或手动粘贴 SVID 列表后生成 S1F3 命令</p>
          </div>
        </div>

        <div class="flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border border-slate-100 flex-wrap">
          <div class="flex items-center gap-2 px-2 shrink-0 whitespace-nowrap">
            <span class="text-sm text-slate-600">数据格式</span>
            <el-input v-model="dataFormat" size="small" class="w-16" placeholder="U4" />
          </div>
          <el-button size="small" type="primary" class="!rounded-md shadow-sm" @click="parseInput">生成S1F3</el-button>
          <el-button size="small" class="!rounded-md" @click="triggerImport">导入 CSV</el-button>
          <el-button size="small" class="!rounded-md" :disabled="!commandText" @click="copyCommand">复制命令</el-button>
          <el-button size="small" class="!rounded-md" :disabled="!commandBodyText" @click="copyCommandBody">仅复制Body</el-button>
          <div class="w-px h-4 bg-slate-300 mx-1"></div>
          <el-button size="small" type="danger" plain class="!rounded-md" @click="clearAll">清空</el-button>
          <input ref="fileInputRef" type="file" class="hidden" accept=".csv,.txt" @change="handleFileImport" />
        </div>
      </div>
    </div>

    <div class="flex-1 grid grid-cols-1 xl:grid-cols-2 gap-4 min-h-0">
      <div class="flex flex-col gap-4 min-h-0">
        <div class="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col min-h-0 flex-1 overflow-hidden">
          <div class="bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center justify-between gap-2">
            <span class="text-sm font-medium text-slate-600">SVID 输入区</span>
            <span class="text-xs text-slate-400">支持 CSV、单列 SVID</span>
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

        <div class="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col min-h-0 flex-1 overflow-hidden">
          <div class="bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center justify-between gap-2">
            <span class="text-sm font-medium text-slate-600">SVID 列表</span>
            <el-tag size="small" type="info" round>共 {{ svidRows.length }} 条</el-tag>
          </div>

          <div class="flex-1 overflow-hidden">
            <el-table :data="svidRows" style="width: 100%" height="100%" border stripe table-layout="auto">
              <el-table-column prop="index" label="序号" width="72" align="center" />
              <el-table-column label="SVID" min-width="150">
                <template #default="{ row }">
                  <el-input v-model="row.svid" size="small" placeholder="请输入 SVID" @input="refreshIndexes" />
                </template>
              </el-table-column>
              <el-table-column label="SVNAME" min-width="180">
                <template #default="{ row }">
                  <el-input v-model="row.svname" size="small" placeholder="SVNAME" />
                </template>
              </el-table-column>
              <el-table-column label="操作" width="84" align="center" fixed="right">
                <template #default="{ $index }">
                  <el-button link type="danger" size="small" @click="removeRow($index)">删除</el-button>
                </template>
              </el-table-column>
              <template #empty>
                <el-empty description="暂无 SVID 数据" :image-size="60" />
              </template>
            </el-table>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
        <div class="bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center justify-between gap-2">
          <span class="text-sm font-medium text-slate-600">S1F3 命令结果</span>
          <span class="text-xs text-slate-400">命令会随列表和数据格式实时更新</span>
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
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { EditPen } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

interface SvidItem {
  index: number
  svid: string
  svname: string
}

const rawInput = ref('')
const dataFormat = ref('U4')
const svidRows = ref<SvidItem[]>([])
const fileInputRef = ref<HTMLInputElement | null>(null)

const commandText = computed(() => {
  const normalizedFormat = dataFormat.value.trim() || 'U4'
  const validRows = svidRows.value.filter(row => row.svid.trim())

  if (!validRows.length) {
    return ''
  }

  const lines = [
    'S1F3 W',
    '<L',
    ...validRows.map(row => `    <${normalizedFormat} "${escapeCommandValue(row.svid.trim())}">`),
    '>.',
  ]

  return lines.join('\n')
})

const commandBodyText = computed(() => {
  const normalizedFormat = dataFormat.value.trim() || 'U4'
  const validRows = svidRows.value.filter(row => row.svid.trim())

  if (!validRows.length) {
    return ''
  }

  return validRows
    .map(row => `    <${normalizedFormat} "${escapeCommandValue(row.svid.trim())}">`)
    .join('\n')
})

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
      } else if (cells.length >= 2 && isNumeric(firstCell)) {
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

function replaceRows(rows: SvidItem[]) {
  svidRows.value = rows.map((row, index) => ({
    index: index + 1,
    svid: row.svid,
    svname: row.svname,
  }))
}

function parseInput() {
  if (!rawInput.value.trim()) {
    ElMessage.warning('请先输入或粘贴 SVID 列表')
    return
  }

  const rows = buildRowsFromLines(rawInput.value)
  replaceRows(rows)

  if (!svidRows.value.length) {
    ElMessage.warning('未识别到有效的 SVID 数据')
    return
  }

  ElMessage.success(`已导入 ${svidRows.value.length} 条 SVID`)
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
    replaceRows(rows)

    if (!svidRows.value.length) {
      ElMessage.warning('文件中未识别到有效的 SVID 数据')
    } else {
      ElMessage.success(`已从文件导入 ${svidRows.value.length} 条 SVID`)
    }
  } catch (error) {
    console.error('Failed to import SVID file', error)
    ElMessage.error('导入文件失败')
  } finally {
    input.value = ''
  }
}

function refreshIndexes() {
  svidRows.value = svidRows.value
    .filter(row => row.svid.trim() || row.svname.trim())
    .map((row, index) => ({
      ...row,
      index: index + 1,
    }))
}

function removeRow(index: number) {
  svidRows.value.splice(index, 1)
  refreshIndexes()
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
  svidRows.value = []
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
</style>

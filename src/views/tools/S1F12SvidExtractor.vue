<template>
  <div class="h-full flex flex-col gap-4" v-loading="loading" :element-loading-text="loadingText">
    <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div class="flex items-center gap-2">
          <div class="p-2 bg-cyan-50 rounded-lg">
            <el-icon class="text-cyan-600 text-xl"><Document /></el-icon>
          </div>
          <div>
            <h2 class="text-lg font-semibold text-slate-800 m-0">S1F12 SVID 提取</h2>
            <p class="text-xs text-slate-500 m-0 mt-0.5">粘贴 S1F12 报文，自动解析并提取 SVID List 内容</p>
          </div>
        </div>

        <div class="flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border border-slate-100 flex-wrap">
          <el-button size="small" type="primary" class="!rounded-md shadow-sm" :loading="loading" :disabled="loading" @click="handleExtract">解析并提取</el-button>
          <el-button size="small" class="!rounded-md" :disabled="loading || !rows.length" @click="exportCsv">导出 CSV</el-button>
          <div class="w-px h-4 bg-slate-300 mx-1"></div>
          <el-button size="small" type="danger" plain class="!rounded-md" :disabled="loading" @click="clearAll">清空</el-button>
        </div>
      </div>
    </div>

    <div class="flex-1 grid grid-cols-1 xl:grid-cols-2 gap-4 min-h-0">
      <div class="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
        <div class="bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center justify-between gap-2">
          <span class="text-sm font-medium text-slate-600">S1F12 原始报文</span>
        </div>
        <div class="flex-1 overflow-hidden relative">
          <textarea
            ref="sourceTextareaRef"
            class="source-textarea w-full h-full absolute inset-0"
            placeholder="请粘贴 S1F12 报文..."
            :disabled="loading"
            spellcheck="false"
          />
        </div>
      </div>

      <div class="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
        <div class="bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center justify-between gap-2">
          <span class="text-sm font-medium text-slate-600">提取结果</span>
          <el-tag size="small" type="info" round>共 {{ rows.length }} 条</el-tag>
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
                  class="svid-virtual-table"
                />
              </template>
            </el-auto-resizer>
          </div>
          <div v-else class="h-full flex items-center justify-center">
            <el-empty description="暂无提取结果" :image-size="60" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ElInput, ElMessage, ElMessageBox } from 'element-plus'
import { Document } from '@element-plus/icons-vue'
import { h, nextTick, ref } from 'vue'

interface SvidRow {
  index: number
  svid: string
  svname: string
  units: string
  remark: string
}

const sourceTextareaRef = ref<HTMLTextAreaElement | null>(null)
const deviceId = ref('')
const rows = ref<SvidRow[]>([])
const loading = ref(false)
const loadingText = '正在解析 S1F12 报文，请稍候...'

const columnMinWidths = {
  index: 80,
  svid: 80,
  svname: 240,
  units: 140,
  remark: 260
} as const

const columnWeights = {
  index: 0.1,
  svid: 0.18,
  svname: 0.28,
  units: 0.16,
  remark: 0.28
} as const

type ExtractWorkerMessage =
  | { type: 'success'; rows: SvidRow[]; warnings?: string[] }
  | { type: 'error'; message: string }

function createTextCell(className: string) {
  return ({ cellData }: { cellData: string | number }) => h('div', { class: className }, String(cellData ?? ''))
}

function buildColumns(containerWidth: number) {
  const safeWidth = Math.max(containerWidth, 0)
  const totalMinWidth = Object.values(columnMinWidths).reduce((sum, width) => sum + width, 0)
  const extraWidth = Math.max(safeWidth - totalMinWidth, 0)

  const resolveWidth = (key: keyof typeof columnMinWidths) => {
    const minWidth = columnMinWidths[key]
    const weightedWidth = totalMinWidth + extraWidth > 0 ? safeWidth * columnWeights[key] : minWidth
    return Math.max(minWidth, Math.round(weightedWidth))
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
      key: 'svid',
      dataKey: 'svid',
      title: 'SVID',
      width: resolveWidth('svid'),
      cellRenderer: createTextCell('table-cell')
    },
    {
      key: 'svname',
      dataKey: 'svname',
      title: 'SVNAME',
      width: resolveWidth('svname'),
      cellRenderer: createTextCell('table-cell')
    },
    {
      key: 'units',
      dataKey: 'units',
      title: 'UNITS',
      width: resolveWidth('units'),
      cellRenderer: createTextCell('table-cell')
    },
    {
      key: 'remark',
      dataKey: 'remark',
      title: '备注',
      width: resolveWidth('remark'),
      cellRenderer: ({ rowData }: { rowData: SvidRow }) => h('div', { class: 'table-input-cell' }, [
        h(ElInput, {
          modelValue: rowData.remark,
          size: 'small',
          placeholder: '可选备注',
          onInput: (value: string) => {
            rowData.remark = value
          }
        })
      ])
    }
  ]
}

function runExtractWorker(text: string) {
  return new Promise<{ rows: SvidRow[]; warnings: string[] }>((resolve, reject) => {
    const worker = new Worker(new URL('./s1f12SvidExtractor.worker.ts', import.meta.url), { type: 'module' })

    const cleanup = () => {
      worker.onmessage = null
      worker.onerror = null
      worker.terminate()
    }

    worker.onmessage = (event: MessageEvent<ExtractWorkerMessage>) => {
      cleanup()

      if (event.data.type === 'success') {
        resolve({ rows: event.data.rows, warnings: event.data.warnings || [] })
        return
      }

      reject(new Error(event.data.message))
    }

    worker.onerror = (event) => {
      cleanup()
      reject(new Error(event.message || '解析失败，请检查报文格式'))
    }

    worker.postMessage(text)
  })
}

function getSourceText() {
  return sourceTextareaRef.value?.value ?? ''
}

async function handleExtract() {
  const sourceText = getSourceText()

  if (!sourceText.trim()) {
    ElMessage.warning('请先粘贴 S1F12 报文')
    return
  }

  if (loading.value) return

  loading.value = true
  rows.value = []

  try {
    await nextTick()
    const extracted = await runExtractWorker(sourceText)
    rows.value = extracted.rows
    if (extracted.warnings.length) {
      ElMessage.warning(extracted.warnings[0] || '报文存在可恢复的解析警告')
    }

    if (!rows.value.length) {
      ElMessage.warning('未在 [0][i][0..2] 位置提取到有效数据，请确认报文结构')
      return
    }

    ElMessage.success(`提取完成，共 ${rows.value.length} 条`)
  } catch (error) {
    rows.value = []
    ElMessage.error(error instanceof Error ? error.message : '解析失败，请检查报文格式')
  } finally {
    loading.value = false
  }
}

function escapeCsvCell(value: string) {
  const normalized = value.replace(/\r?\n/g, ' ')
  if (/[",\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`
  }

  return normalized
}

async function exportCsv() {
  if (!rows.value.length) {
    ElMessage.warning('当前没有可导出的数据')
    return
  }

  try {
    const { value } = await ElMessageBox.prompt('如需在文件名前添加设备号，请在下方填写。', '导出 CSV', {
      inputValue: deviceId.value,
      inputPlaceholder: '可选设备号',
      confirmButtonText: '导出',
      cancelButtonText: '取消'
    })

    deviceId.value = value.trim()
  } catch {
    return
  }

  const header = ['序号', 'SVID', 'SVNAME', 'UNITS', '备注']
  const content = [
    header.join(','),
    ...rows.value.map(row => [
      String(row.index),
      escapeCsvCell(row.svid),
      escapeCsvCell(row.svname),
      escapeCsvCell(row.units),
      escapeCsvCell(row.remark)
    ].join(','))
  ].join('\n')

  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const now = new Date()
  const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`
  const normalizedDeviceId = deviceId.value.trim().replace(/[\\/:*?"<>|]/g, '-')
  const fileNamePrefix = normalizedDeviceId ? `${normalizedDeviceId}-` : ''

  link.href = url
  link.download = `${fileNamePrefix}s1f12-svid-${timestamp}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)

  ElMessage.success('CSV 导出成功')
}

function clearAll() {
  if (loading.value) return

  if (sourceTextareaRef.value) {
    sourceTextareaRef.value.value = ''
  }
  deviceId.value = ''
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

.svid-virtual-table :deep(.el-table-v2__header-cell),
.svid-virtual-table :deep(.el-table-v2__row-cell) {
  border-bottom: 1px solid rgb(226 232 240);
  border-right: 1px solid rgb(226 232 240);
}

.svid-virtual-table :deep(.el-table-v2__header-cell) {
  background: rgb(248 250 252);
  color: rgb(71 85 105);
  font-weight: 500;
}

.svid-virtual-table :deep(.el-table-v2__row-cell) {
  background: rgb(255 255 255);
}

.svid-virtual-table :deep(.el-table-v2__row:hover .el-table-v2__row-cell) {
  background: rgb(248 250 252);
}

.table-cell,
.table-input-cell {
  display: flex;
  align-items: center;
  height: 100%;
  width: 100%;
  padding: 0 8px;
}

.table-cell {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 13px;
}

.table-cell-center {
  justify-content: center;
}

.table-input-cell :deep(.el-input) {
  width: 100%;
}

.table-input-cell :deep(.el-input__wrapper) {
  padding: 0 8px;
}
</style>

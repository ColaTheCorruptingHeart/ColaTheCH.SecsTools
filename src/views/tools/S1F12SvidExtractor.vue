<template>
  <div class="h-full flex flex-col gap-4">
    <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div class="flex items-center gap-2">
          <div class="p-2 bg-cyan-50 rounded-lg">
            <el-icon class="text-cyan-600 text-xl"><Document /></el-icon>
          </div>
          <div>
            <h2 class="text-lg font-semibold text-slate-800 m-0">S1F12 SVID 提取</h2>
            <p class="text-xs text-slate-500 m-0 mt-0.5">粘贴 S1F12 报文，先格式化再提取SVID List内容</p>
          </div>
        </div>

        <div class="flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border border-slate-100 flex-wrap">
          <el-button size="small" type="primary" class="!rounded-md shadow-sm" @click="handleExtract">格式化并提取</el-button>
          <el-button size="small" class="!rounded-md" :disabled="!rows.length" @click="exportCsv">导出 CSV</el-button>
          <div class="w-px h-4 bg-slate-300 mx-1"></div>
          <el-button size="small" type="danger" plain class="!rounded-md" @click="clearAll">清空</el-button>
        </div>
      </div>
    </div>

    <div class="flex-1 grid grid-cols-1 xl:grid-cols-2 gap-4 min-h-0">
      <div class="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
        <div class="bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center justify-between gap-2">
          <span class="text-sm font-medium text-slate-600">S1F12 原始报文</span>
          <span class="text-xs text-slate-400">提取前会先自动格式化</span>
        </div>
        <div class="flex-1 overflow-hidden relative">
          <el-input
            v-model="sourceText"
            type="textarea"
            class="code-input w-full h-full absolute inset-0"
            placeholder="请粘贴 S1F12 报文..."
            resize="none"
          />
        </div>
      </div>

      <div class="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
        <div class="bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center justify-between gap-2">
          <span class="text-sm font-medium text-slate-600">提取结果</span>
          <el-tag size="small" type="info" round>共 {{ rows.length }} 条</el-tag>
        </div>

        <div class="flex-1 overflow-hidden">
          <el-table
            :data="rows"
            style="width: 100%"
            height="100%"
            border
            stripe
            table-layout="auto"
          >
            <el-table-column prop="index" label="序号" width="72" align="center" />
            <el-table-column prop="svid" label="SVID" min-width="140" />
            <el-table-column prop="svname" label="SVNAME" min-width="180" />
            <el-table-column prop="units" label="UNITS" min-width="120" />
            <el-table-column label="备注" min-width="220">
              <template #default="{ row }">
                <el-input v-model="row.remark" size="small" placeholder="可选备注" />
              </template>
            </el-table-column>
            <template #empty>
              <el-empty description="暂无提取结果" :image-size="60" />
            </template>
          </el-table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Document } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { formatSecsSml, getNodeValueText, parseSmlTree, type SecsSmlNode } from './secsSml'

interface SvidRow {
  index: number
  svid: string
  svname: string
  units: string
  remark: string
}

const sourceText = ref('')
const deviceId = ref('')
const rows = ref<SvidRow[]>([])
const formattedText = ref('')

function normalizeCellValue(node: SecsSmlNode | undefined) {
  const rawValue = getNodeValueText(node)
  if (!rawValue) return ''

  if (rawValue.startsWith('"') && rawValue.endsWith('"')) {
    return rawValue.slice(1, -1)
  }

  return rawValue
}

function extractRows(rootNode: SecsSmlNode | undefined) {
  if (!rootNode) return []

  return rootNode.children
    .map((itemNode, index) => ({
      index: index + 1,
      svid: normalizeCellValue(itemNode.children[0]),
      svname: normalizeCellValue(itemNode.children[1]),
      units: normalizeCellValue(itemNode.children[2]),
      remark: ''
    }))
    .filter(row => row.svid || row.svname || row.units)
}

function handleExtract() {
  if (!sourceText.value.trim()) {
    ElMessage.warning('请先粘贴 S1F12 报文')
    return
  }

  const formatted = formatSecsSml(sourceText.value)
  formattedText.value = formatted.text

  if (!formattedText.value.trim()) {
    rows.value = []
    ElMessage.warning('报文格式化失败，无法继续提取')
    return
  }

  const parsed = parseSmlTree(formattedText.value)
  const extractedRows = extractRows(parsed.roots[0])

  rows.value = extractedRows

  if (!rows.value.length) {
    ElMessage.warning('未在 [0][i][0..2] 位置提取到有效数据，请确认报文结构')
    return
  }

  ElMessage.success(`提取完成，共 ${rows.value.length} 条`)
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
  sourceText.value = ''
  deviceId.value = ''
  formattedText.value = ''
  rows.value = []
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

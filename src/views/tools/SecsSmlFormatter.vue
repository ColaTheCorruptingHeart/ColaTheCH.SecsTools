<template>
  <div class="h-full flex flex-col gap-4">
    <!-- Header Tool Bar -->
    <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div class="flex items-center gap-2">
          <div class="p-2 bg-amber-50 rounded-lg">
            <el-icon class="text-amber-500 text-xl"><Document /></el-icon>
          </div>
          <div>
            <h2 class="text-lg font-semibold text-slate-800 m-0">SECS SML 格式化工具</h2>
            <p class="text-xs text-slate-500 m-0 mt-0.5">粘贴原始报文日志，自动输出简洁层级格式</p>
          </div>
        </div>

        <div class="flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border border-slate-100 flex-wrap">
          <el-button size="small" type="primary" class="!rounded-md shadow-sm" @click="onFormat">格式化</el-button>
          <el-button size="small" class="!rounded-md" @click="onCopy">复制结果</el-button>
          <div class="w-px h-4 bg-slate-300 mx-1"></div>
          <el-button size="small" type="danger" plain class="!rounded-md" @click="onClear">清空</el-button>

          <div class="flex items-center ml-2 border-l border-slate-300 pl-3">
            <el-input
              v-model="locatePathInput"
              size="small"
              placeholder="输入路径，如 [0][2][2]"
              @keyup.enter="onLocateByPath"
              class="w-40 mr-2"
            />
            <el-button size="small" class="!rounded-md" @click="onLocateByPath">定位</el-button>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Workspace -->
    <div class="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 min-h-0">
      <!-- Input Section -->
      <div class="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
        <div class="bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center justify-between">
          <span class="text-sm font-medium text-slate-600">原始 SECS 日志</span>
        </div>
        <div class="flex-1 overflow-hidden relative">
          <el-input
            v-model="sourceText"
            type="textarea"
            class="code-input w-full h-full absolute inset-0"
            placeholder="请输入原始日志..."
            resize="none"
          />
        </div>
      </div>

      <!-- Output Section -->
      <div class="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
        <div class="bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center justify-between">
          <span class="text-sm font-medium text-slate-600">格式化结果</span>
          <span class="text-xs text-slate-400 font-mono hidden sm:inline-block max-w-[200px] truncate" :title="selectedPath">
            {{ selectedPath ? ('当前位置：' + selectedPath) : '点击值、<L 或 > 行查看路径' }}
          </span>
        </div>

        <div
          ref="resultBoxRef"
          class="flex-1 p-4 overflow-auto bg-slate-50/30 result-container"
        >
          <div v-if="formattedLines.length === 0" class="text-slate-400 text-sm text-center mt-10">
            结果将在此显示...
          </div>
          <template v-else>
            <div
              v-for="(line, idx) in formattedLines"
              :key="idx"
              :data-line-idx="idx"
              class="result-line text-sm font-mono whitespace-pre"
              :class="{
                clickable: line.clickable,
                active: selectedLineIndex === idx,
                blink: blinkLineIndex === idx
              }"
              @click="onSelectLine(idx)"
              @dblclick="onDoubleClickLine(idx)"
            >{{ line.text }}</div>
          </template>
        </div>
        <div class="bg-slate-50 border-t border-slate-200 px-4 py-1.5 flex items-center justify-between shrink-0">
          <span class="text-xs text-slate-500">提示：点击可查看路径，双击可弹框并复制；也可输入路径直接定位。</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { Document } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'

// State
const sourceText = ref('')
const formattedText = ref('')
const formattedLines = ref<any[]>([])
const selectedPath = ref('')
const selectedLineIndex = ref(-1)
const blinkLineIndex = ref(-1)
const locatePathInput = ref('')
const resultBoxRef = ref<HTMLElement | null>(null)
let blinkTimer: any = null

// Core Parsing Logic
function extractHeader(input: string) {
  const sfMatch = input.match(/\bS\d+F\d+\b/i)
  const wMatch = input.match(/\bW\b/)
  const sf = sfMatch ? sfMatch[0].toUpperCase() : ''
  const w = wMatch ? ' W' : ''
  return `${sf}${w}`.trim()
}

function normalizeOpenLine(line: string) {
  const trimmed = line.trim()
  const hasClose = trimmed.endsWith('>')
  const inner = trimmed.slice(1, hasClose ? -1 : undefined).trim()

  const cleaned = inner
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  const partMatch = cleaned.match(/^([A-Za-z0-9]+)(?:,\d+)?\s*(.*)$/)
  const type = partMatch ? partMatch[1] : cleaned
  const value = partMatch && partMatch[2] ? partMatch[2].trim() : ''

  return `<${type}${value ? ' ' + value : ''}${hasClose ? '>' : ''}`
}

function pathToString(path: number[]) {
  return path.map(v => `[${v}]`).join('')
}

function parseSmlTree(rawText: string) {
  if (!rawText || !rawText.trim()) {
    return { header: '', roots: [], hasTerminalDot: false }
  }

  const lines = rawText.split(/\r?\n/)
  const firstStructLine = lines.findIndex(l => l.trim().startsWith('<'))
  if (firstStructLine === -1) {
    return { header: extractHeader(rawText) || rawText.trim(), roots: [], hasTerminalDot: false }
  }

  const header = extractHeader(rawText)
  const roots: any[] = []
  const stack: any[] = []
  let hasTerminalDot = false

  for (let i = firstStructLine; i < lines.length; i += 1) {
    const line = lines[i]?.trim() || ''
    if (!line) continue

    if (line.startsWith('<')) {
      const normalized = normalizeOpenLine(line)
      const node = { text: normalized, children: [] as any[] }

      if (stack.length) {
        stack[stack.length - 1].children.push(node)
      } else {
        roots.push(node)
      }

      if (!normalized.endsWith('>')) {
        stack.push(node)
      }
      continue
    }

    if (line.startsWith('>')) {
      if (line.endsWith('.')) hasTerminalDot = true
      if (stack.length) stack.pop()
      continue
    }
  }

  return { header, roots, hasTerminalDot }
}

function buildFormattedResult(parsed: any) {
  const lines: any[] = []

  if (parsed.header) {
    lines.push({ text: parsed.header, clickable: false, path: '' })
  }

  function walk(node: any, depth: number, path: number[]) {
    const text = `${'    '.repeat(depth)}${node.text}`
    const isValueLine = /'.*'/.test(node.text)
    const isLLine = /^<L\b/.test(node.text)
    const isClickable = isValueLine || isLLine
    const openLineIndex = lines.length

    lines.push({
      text,
      clickable: isClickable,
      path: isClickable ? pathToString(path) : '',
      jumpToIndex: openLineIndex
    })

    if (node.children.length > 0) {
      node.children.forEach((child: any, idx: number) => walk(child, depth + 1, path.concat(idx)))
      lines.push({
        text: `${'    '.repeat(depth)}>` + (depth === 0 && parsed.hasTerminalDot ? '.' : ''),
        clickable: true,
        path: pathToString(path),
        jumpToIndex: openLineIndex
      })
    }
  }

  parsed.roots.forEach((root: any, idx: number) => walk(root, 0, [idx]))
  return lines
}

function formatSecsSml(rawText: string) {
  const parsed = parseSmlTree(rawText)
  const lines = buildFormattedResult(parsed)
  return { lines, text: lines.map(line => line.text).join('\n') }
}

// Handlers
const onFormat = () => {
  if (!sourceText.value.trim()) {
    ElMessage.warning('请输入原始数据')
    return
  }
  const result = formatSecsSml(sourceText.value)
  formattedText.value = result.text
  formattedLines.value = result.lines
  selectedPath.value = ''
  selectedLineIndex.value = -1
  blinkLineIndex.value = -1
  ElMessage.success('格式化完成')
}

const onClear = () => {
  sourceText.value = ''
  formattedText.value = ''
  formattedLines.value = []
  selectedPath.value = ''
  selectedLineIndex.value = -1
  blinkLineIndex.value = -1
  locatePathInput.value = ''
}

const startBlink = (lineIndex: number) => {
  if (blinkTimer) clearTimeout(blinkTimer)
  blinkLineIndex.value = lineIndex
  blinkTimer = setTimeout(() => { blinkLineIndex.value = -1 }, 1800)
}

const scrollToLine = (lineIndex: number) => {
  const box = resultBoxRef.value
  if (!box) return
  const row = box.querySelector(`[data-line-idx="${lineIndex}"]`)
  if (!row) return
  row.scrollIntoView({ block: 'center', behavior: 'smooth' })
}

const focusLine = async (lineIndex: number, path: string, messageText: string) => {
  selectedPath.value = path
  selectedLineIndex.value = lineIndex
  await nextTick()
  scrollToLine(lineIndex)
  startBlink(lineIndex)
  if (messageText) {
    ElMessage({ type: 'success', message: messageText, duration: 1600 })
  }
}

const onSelectLine = async (idx: number) => {
  const line = formattedLines.value[idx]
  if (!line || !line.clickable) return
  const targetIndex = Number.isInteger(line.jumpToIndex) ? line.jumpToIndex : idx
  await focusLine(targetIndex, line.path, `当前位置：${line.path}`)
}

const normalizePath = (raw: string) => raw.replace(/[（）()\s]/g, '').trim()

const onLocateByPath = async () => {
  if (!formattedLines.value.length) {
    ElMessage.warning('请先执行格式化')
    return
  }

  const normalized = normalizePath(locatePathInput.value || '')
  if (!/^(\[\d+\])+$/.test(normalized)) {
    ElMessage.warning('路径格式无效，请使用如 [0][2][2][1][0][0][0]')
    return
  }

  const preferredIndex = formattedLines.value.findIndex(
    line => line.path === normalized && !line.text.trim().startsWith('>')
  )
  const targetIndex = preferredIndex >= 0
    ? preferredIndex
    : formattedLines.value.findIndex(line => line.path === normalized)

  if (targetIndex < 0) {
    ElMessage.warning('未找到该位置，请确认路径是否正确')
    return
  }

  await focusLine(targetIndex, normalized, `已定位到：${normalized}`)
}

const onDoubleClickLine = async (idx: number) => {
  const line = formattedLines.value[idx]
  if (!line || !line.clickable || !line.path) return

  const path = line.path

  try {
    await navigator.clipboard.writeText(path)

    // 弹框显示所选位置，并提示已复制
    ElMessageBox.alert(
      `<div class="mt-2 text-center text-lg font-mono text-amber-600 bg-amber-50 p-4 rounded-lg border border-amber-200">${path}</div>`,
      '位置已选择并自动复制',
      {
        dangerouslyUseHTMLString: true,
        confirmButtonText: '确定',
        type: 'success',
        center: true
      }
    )
  } catch (e) {
    ElMessageBox.alert(
      `<div class="mt-2 text-center text-lg font-mono text-amber-600 bg-amber-50 p-4 rounded-lg border border-amber-200">${path}</div>`,
      '所选位置 (复制失败，请手动复制)',
      { dangerouslyUseHTMLString: true, confirmButtonText: '确定' }
    )
  }
}

const onCopy = async () => {
  if (!formattedText.value) {
    ElMessage.warning('请先执行格式化')
    return
  }
  try {
    await navigator.clipboard.writeText(formattedText.value)
    ElMessage.success('已复制结果')
  } catch (e) {
    ElMessage.error('复制失败，请手动复制')
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

.result-container {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  line-height: 1.6;
}

.result-line {
  padding: 1px 6px;
  border-radius: 4px;
  min-height: 22px;
  color: #334155;
  transition: all 0.2s ease;
}

.result-line.clickable {
  cursor: pointer;
}

.result-line.clickable:hover {
  background: #fef3c7; /* amber-50 equivalent */
}

.result-line.active {
  background: #fde68a !important; /* amber-200 */
  color: #92400e; /* amber-800 */
  font-weight: 600;
}

.result-line.blink {
  animation: blink-target 0.9s ease 2;
}

@keyframes blink-target {
  0% { box-shadow: inset 0 0 0 999px rgba(251, 191, 36, 0.2); }
  50% { box-shadow: inset 0 0 0 999px rgba(245, 158, 11, 0.4); }
  100% { box-shadow: inset 0 0 0 999px rgba(251, 191, 36, 0.2); }
}
</style>

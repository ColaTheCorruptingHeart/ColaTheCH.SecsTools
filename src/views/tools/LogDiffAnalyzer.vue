<template>
  <div ref="pageRoot" class="log-diff-page">
    <div class="log-diff-workbench">
      <section class="diff-pane">
        <header class="diff-pane__header">
          <div class="diff-pane__title-row">
            <h2>左侧日志</h2>
            <p>{{ leftStats }}</p>
          </div>
          <span class="diff-pane__badge">Baseline</span>
        </header>
        <div class="diff-editor-wrap">
          <Codemirror
            v-model="leftDiffText"
            :style="{ height: '100%' }"
            :extensions="leftDiffExtensions"
            @ready="handleLeftDiffReady"
          />
        </div>
      </section>

      <section class="diff-pane">
        <header class="diff-pane__header">
          <div class="diff-pane__title-row">
            <h2>右侧日志</h2>
            <p>{{ rightStats }}</p>
          </div>
          <div class="diff-pane__actions">
            <span class="diff-pane__badge diff-pane__badge--right">Compare</span>
            <el-button v-if="hasCompared" type="primary" plain size="small" @click="openInputDialog">重新输入</el-button>
          </div>
        </header>
        <div class="diff-editor-wrap">
          <Codemirror
            v-model="rightDiffText"
            :style="{ height: '100%' }"
            :extensions="rightDiffExtensions"
            @ready="handleRightDiffReady"
          />
        </div>
      </section>
    </div>

    <div v-if="!hasCompared" class="diff-empty-state">
      <el-button type="primary" @click="openInputDialog">输入日志内容</el-button>
    </div>

    <el-dialog
      v-model="inputDialogVisible"
      title="日志差异分析"
      width="86vw"
      align-center
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      class="log-diff-dialog"
    >
      <div class="log-diff-dialog__body">
        <section class="input-pane">
          <header class="input-pane__header">
            <span>左侧日志</span>
            <span>{{ getInputStats(leftInput) }}</span>
          </header>
          <div class="input-editor-wrap">
            <Codemirror
              v-model="leftInput"
              placeholder="粘贴第一份日志..."
              :style="{ height: '100%' }"
              :extensions="inputExtensions"
            />
          </div>
        </section>

        <section class="input-pane">
          <header class="input-pane__header">
            <span>右侧日志</span>
            <span>{{ getInputStats(rightInput) }}</span>
          </header>
          <div class="input-editor-wrap">
            <Codemirror
              v-model="rightInput"
              placeholder="粘贴第二份日志..."
              :style="{ height: '100%' }"
              :extensions="inputExtensions"
            />
          </div>
        </section>
      </div>

      <template #footer>
        <div class="log-diff-dialog__footer">
          <span>当前仅支持手动输入或粘贴日志内容</span>
          <el-button type="primary" @click="runCompare">对比</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef } from 'vue'
import { Codemirror } from 'vue-codemirror'
import { useRoute } from 'vue-router'
import { Compartment, EditorState, type Extension, type Range, type Text } from '@codemirror/state'
import { Decoration, EditorView, lineNumbers } from '@codemirror/view'
import { ElMessage } from 'element-plus'
import { consumeLogDiffTransferPayload } from './logDiffTransfer'

type DiffKind = 'equal' | 'delete' | 'insert' | 'replace'

interface DiffRow {
  kind: DiffKind
  left: string
  right: string
}

const pageRoot = ref<HTMLDivElement | null>(null)
const route = useRoute()
const inputDialogVisible = ref(false)
const hasCompared = ref(false)
const leftInput = ref('')
const rightInput = ref('')
const leftDiffText = ref('')
const rightDiffText = ref('')
const diffRows = ref<DiffRow[]>([])
const leftDiffViewRef = shallowRef<EditorView>()
const rightDiffViewRef = shallowRef<EditorView>()

let mainContentElement: HTMLElement | null = null
let previousMainPadding = ''
let previousMainPaddingVariable = ''

const leftDecorationCompartment = new Compartment()
const rightDecorationCompartment = new Compartment()

const countLines = (text: string) => {
  if (!text) return 0

  let lineCount = 1
  for (let index = 0; index < text.length; index += 1) {
    if (text.charCodeAt(index) === 10) {
      lineCount += 1
    }
  }

  return lineCount
}

const getInputStats = (text: string) => {
  return `${countLines(text)} 行 / ${text.length.toLocaleString()} 字符`
}

const leftStats = computed(() => {
  const deleted = diffRows.value.filter(row => row.kind === 'delete' || row.kind === 'replace').length
  return hasCompared.value ? `${countLines(leftInput.value)} 行，${deleted} 行差异` : '等待输入日志'
})

const rightStats = computed(() => {
  const inserted = diffRows.value.filter(row => row.kind === 'insert' || row.kind === 'replace').length
  return hasCompared.value ? `${countLines(rightInput.value)} 行，${inserted} 行差异` : '等待输入日志'
})

const editorTheme = EditorView.theme({
  '&': {
    height: '100%',
    backgroundColor: '#ffffff'
  },
  '.cm-scroller': {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace !important',
    fontSize: '12px',
    lineHeight: '1.55'
  },
  '.cm-content': {
    padding: '8px 0'
  },
  '.cm-line': {
    padding: '0 10px'
  },
  '.cm-gutters': {
    backgroundColor: '#f8fafc',
    borderRight: '1px solid #e2e8f0',
    color: '#94a3b8'
  },
  '.cm-diff-delete': {
    backgroundColor: 'rgba(239, 68, 68, 0.16) !important',
    boxShadow: 'inset 3px 0 0 #ef4444'
  },
  '.cm-diff-insert': {
    backgroundColor: 'rgba(16, 185, 129, 0.18) !important',
    boxShadow: 'inset 3px 0 0 #10b981'
  },
  '.cm-diff-replace-left': {
    backgroundColor: 'rgba(245, 158, 11, 0.18) !important',
    boxShadow: 'inset 3px 0 0 #f59e0b'
  },
  '.cm-diff-replace-right': {
    backgroundColor: 'rgba(14, 165, 233, 0.18) !important',
    boxShadow: 'inset 3px 0 0 #0ea5e9'
  }
})

const inputExtensions: Extension[] = [
  editorTheme,
  lineNumbers(),
  EditorView.lineWrapping
]

const createDiffDecorations = (side: 'left' | 'right', doc: Text) => {
  const decorations: Array<Range<Decoration>> = []

  diffRows.value.forEach((row, index) => {
    const isLeftMarked = side === 'left' && (row.kind === 'delete' || row.kind === 'replace')
    const isRightMarked = side === 'right' && (row.kind === 'insert' || row.kind === 'replace')

    if (!isLeftMarked && !isRightMarked) {
      return
    }

    const lineNumber = index + 1
    if (lineNumber > doc.lines) {
      return
    }

    let className = ''
    if (row.kind === 'replace') {
      className = side === 'left' ? 'cm-diff-replace-left' : 'cm-diff-replace-right'
    } else if (row.kind === 'delete') {
      className = 'cm-diff-delete'
    } else if (row.kind === 'insert') {
      className = 'cm-diff-insert'
    }

    decorations.push(Decoration.line({ attributes: { class: className } }).range(doc.line(lineNumber).from))
  })

  return Decoration.set(decorations, true)
}

const leftDiffExtensions: Extension[] = [
  editorTheme,
  lineNumbers(),
  EditorState.readOnly.of(true),
  leftDecorationCompartment.of(EditorView.decorations.of(Decoration.none))
]

const rightDiffExtensions: Extension[] = [
  editorTheme,
  lineNumbers(),
  EditorState.readOnly.of(true),
  rightDecorationCompartment.of(EditorView.decorations.of(Decoration.none))
]

const updateDiffHighlights = () => {
  if (leftDiffViewRef.value) {
    leftDiffViewRef.value.dispatch({
      effects: leftDecorationCompartment.reconfigure(
        EditorView.decorations.of(createDiffDecorations('left', leftDiffViewRef.value.state.doc))
      )
    })
  }

  if (rightDiffViewRef.value) {
    rightDiffViewRef.value.dispatch({
      effects: rightDecorationCompartment.reconfigure(
        EditorView.decorations.of(createDiffDecorations('right', rightDiffViewRef.value.state.doc))
      )
    })
  }
}

const handleLeftDiffReady = (payload: { view: EditorView }) => {
  leftDiffViewRef.value = payload.view
  updateDiffHighlights()
}

const handleRightDiffReady = (payload: { view: EditorView }) => {
  rightDiffViewRef.value = payload.view
  updateDiffHighlights()
}

const splitLines = (text: string) => {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
}

const buildLineDiff = (leftLines: string[], rightLines: string[]) => {
  const leftLength = leftLines.length
  const rightLength = rightLines.length
  const matrix: number[][] = Array.from({ length: leftLength + 1 }, () => Array(rightLength + 1).fill(0))
  const getMatrixValue = (leftIndex: number, rightIndex: number) => matrix[leftIndex]?.[rightIndex] ?? 0

  for (let leftIndex = leftLength - 1; leftIndex >= 0; leftIndex -= 1) {
    for (let rightIndex = rightLength - 1; rightIndex >= 0; rightIndex -= 1) {
      if (leftLines[leftIndex] === rightLines[rightIndex]) {
        matrix[leftIndex]![rightIndex] = getMatrixValue(leftIndex + 1, rightIndex + 1) + 1
      } else {
        matrix[leftIndex]![rightIndex] = Math.max(getMatrixValue(leftIndex + 1, rightIndex), getMatrixValue(leftIndex, rightIndex + 1))
      }
    }
  }

  const rows: DiffRow[] = []
  let leftIndex = 0
  let rightIndex = 0

  while (leftIndex < leftLength && rightIndex < rightLength) {
    if (leftLines[leftIndex] === rightLines[rightIndex]) {
      rows.push({ kind: 'equal', left: leftLines[leftIndex] ?? '', right: rightLines[rightIndex] ?? '' })
      leftIndex += 1
      rightIndex += 1
    } else if (getMatrixValue(leftIndex + 1, rightIndex) >= getMatrixValue(leftIndex, rightIndex + 1)) {
      rows.push({ kind: 'delete', left: leftLines[leftIndex] ?? '', right: '' })
      leftIndex += 1
    } else {
      rows.push({ kind: 'insert', left: '', right: rightLines[rightIndex] ?? '' })
      rightIndex += 1
    }
  }

  while (leftIndex < leftLength) {
    rows.push({ kind: 'delete', left: leftLines[leftIndex] ?? '', right: '' })
    leftIndex += 1
  }

  while (rightIndex < rightLength) {
    rows.push({ kind: 'insert', left: '', right: rightLines[rightIndex] ?? '' })
    rightIndex += 1
  }

  return compactReplaceRows(rows)
}

const compactReplaceRows = (rows: DiffRow[]) => {
  const compacted: DiffRow[] = []

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    const nextRow = rows[index + 1]

    if (row?.kind === 'delete' && nextRow?.kind === 'insert') {
      compacted.push({ kind: 'replace', left: row.left, right: nextRow.right })
      index += 1
      continue
    }

    if (row?.kind === 'insert' && nextRow?.kind === 'delete') {
      compacted.push({ kind: 'replace', left: nextRow.left, right: row.right })
      index += 1
      continue
    }

    if (row) {
      compacted.push(row)
    }
  }

  return compacted
}

const openInputDialog = () => {
  inputDialogVisible.value = true
}

const runCompare = () => {
  if (!leftInput.value.trim() && !rightInput.value.trim()) {
    ElMessage.warning('请先输入或粘贴两份日志内容')
    return
  }

  const rows = buildLineDiff(splitLines(leftInput.value), splitLines(rightInput.value))
  diffRows.value = rows
  leftDiffText.value = rows.map(row => row.left).join('\n')
  rightDiffText.value = rows.map(row => row.right).join('\n')
  hasCompared.value = true
  inputDialogVisible.value = false
  nextTick(updateDiffHighlights)
}

const removeTransferQueryFromUrl = () => {
  const url = new URL(window.location.href)
  url.searchParams.delete('source')
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
}

const loadTransferredDiffPayload = async () => {
  const sourceQuery = route.query.source
  const transferId = Array.isArray(sourceQuery) ? sourceQuery[0] : sourceQuery
  if (!transferId) {
    return
  }

  removeTransferQueryFromUrl()
  const payload = consumeLogDiffTransferPayload(transferId)
  if (!payload) {
    ElMessage.warning('未找到待对比的日志内容')
    return
  }

  leftInput.value = payload.left
  rightInput.value = payload.right
  inputDialogVisible.value = false
  await nextTick()
  runCompare()
}

const applyPagePadding = () => {
  const nextMainElement = pageRoot.value?.closest('.el-main')
  if (!(nextMainElement instanceof HTMLElement)) {
    return
  }

  mainContentElement = nextMainElement
  previousMainPadding = nextMainElement.style.padding
  previousMainPaddingVariable = nextMainElement.style.getPropertyValue('--el-main-padding')

  nextMainElement.style.padding = '10px'
  nextMainElement.style.setProperty('--el-main-padding', '10px')
}

const restorePagePadding = () => {
  if (!mainContentElement) {
    return
  }

  mainContentElement.style.padding = previousMainPadding

  if (previousMainPaddingVariable) {
    mainContentElement.style.setProperty('--el-main-padding', previousMainPaddingVariable)
  } else {
    mainContentElement.style.removeProperty('--el-main-padding')
  }

  mainContentElement = null
}

onMounted(() => {
  applyPagePadding()
  void loadTransferredDiffPayload()
})

onUnmounted(() => {
  restorePagePadding()
})
</script>

<style scoped>
.log-diff-page {
  position: relative;
  height: 100%;
  min-height: 0;
}

.log-diff-workbench {
  display: flex;
  height: 100%;
  min-height: 0;
  gap: 8px;
}

.diff-pane {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #ffffff;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
}

.diff-pane__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
  padding: 7px 14px;
  min-height: 42px;
}

.diff-pane__title-row {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 10px;
  white-space: nowrap;
}

.diff-pane__title-row h2 {
  flex: 0 0 auto;
  margin: 0;
  color: #334155;
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
}

.diff-pane__title-row p {
  min-width: 0;
  overflow: hidden;
  margin: 0;
  color: #64748b;
  font-size: 12px;
  line-height: 18px;
  text-overflow: ellipsis;
}

.diff-pane__badge {
  border: 1px solid #fecaca;
  border-radius: 999px;
  background: #fef2f2;
  padding: 2px 8px;
  color: #b91c1c;
  font-size: 11px;
  font-weight: 700;
  line-height: 16px;
}

.diff-pane__badge--right {
  border-color: #bbf7d0;
  background: #f0fdf4;
  color: #047857;
}

.diff-pane__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.diff-editor-wrap {
  min-height: 0;
  flex: 1;
  overflow: hidden;
}

.diff-empty-state {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed #cbd5e1;
  border-radius: 12px;
  background: rgba(248, 250, 252, 0.78);
}

.log-diff-dialog :deep(.el-dialog) {
  max-width: 1320px;
}

.log-diff-dialog :deep(.el-dialog__body) {
  padding: 10px 18px 0;
}

.log-diff-dialog__body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 10px;
  height: min(72vh, 760px);
  min-height: 520px;
}

.input-pane {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid #dbe3ef;
  border-radius: 10px;
  background: #ffffff;
}

.input-pane__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
  padding: 8px 12px;
  color: #475569;
  font-size: 13px;
  font-weight: 600;
}

.input-pane__header span:last-child {
  color: #94a3b8;
  font-size: 12px;
  font-weight: 500;
}

.input-editor-wrap {
  min-height: 0;
  flex: 1;
  overflow: hidden;
}

.log-diff-dialog__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
}

.log-diff-dialog__footer span {
  color: #64748b;
  font-size: 12px;
}

:deep(.cm-scroller::-webkit-scrollbar) {
  width: 14px;
  height: 14px;
  background-color: transparent;
}

:deep(.cm-scroller::-webkit-scrollbar-track) {
  background-color: transparent;
}

:deep(.cm-scroller::-webkit-scrollbar-thumb) {
  border: 4px solid transparent;
  border-radius: 9999px;
  background-color: rgba(100, 116, 139, 0.8);
  background-clip: padding-box;
}

:deep(.cm-scroller::-webkit-scrollbar-thumb:hover) {
  background-color: rgba(71, 85, 105, 1);
}

:deep(.cm-scroller::-webkit-scrollbar-corner) {
  background-color: transparent;
}

@media (max-width: 900px) {
  .log-diff-workbench,
  .log-diff-dialog__body {
    grid-template-columns: 1fr;
    flex-direction: column;
  }

  .log-diff-dialog__body {
    height: 76vh;
    min-height: 0;
  }
}
</style>

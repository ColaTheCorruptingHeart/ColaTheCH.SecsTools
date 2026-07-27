<template>
  <div ref="pageRoot" class="general-diff-page">
    <section v-if="hasCompared" class="result-pane" v-loading="isRenderingDiff">
      <header class="result-pane__header">
        <div class="result-pane__title-row">
          <h2>差异结果</h2>
          <p>{{ resultStats }}</p>
        </div>
        <div class="result-pane__actions">
          <el-button size="small" plain @click="openInputDialog">重新输入</el-button>
          <span v-if="isLargeComparison" class="result-pane__badge">大文本模式</span>
          <span class="result-pane__badge result-pane__badge--side">Side by side</span>
        </div>
      </header>
      <div ref="diffResultWrap" class="diff-result-wrap">
        <CodeDiff
          v-if="comparedLeft || comparedRight"
          :key="compareVersion"
          :old-string="comparedLeft"
          :new-string="comparedRight"
          language="plaintext"
          output-format="side-by-side"
          :diff-style="renderDiffStyle"
          :context="renderContext"
          :max-height="diffMaxHeight"
          :force-inline-comparison="false"
          :no-diff-line-feed="true"
          filename="原始文本"
          new-filename="对比文本"
          @diff="handleDiffResult"
        />
        <div
          v-if="diffBarMarks.length"
          class="diff-overview-bar"
          aria-label="差异概览"
          :style="{ bottom: `${diffOverviewBottomOffset}px` }"
        >
          <span
            v-for="(mark, index) in diffBarMarks"
            :key="`${mark.kind}-${index}-${mark.top}`"
            class="diff-overview-bar__mark"
            :class="`diff-overview-bar__mark--${mark.kind}`"
            :style="{ top: `${mark.top}%`, height: `${mark.height}%` }"
          />
        </div>
        <div v-if="!(comparedLeft || comparedRight)" class="diff-result-empty">等待生成差异结果</div>
      </div>
    </section>

    <div v-else class="diff-empty-state">
      <el-button type="primary" @click="openInputDialog">输入文本内容</el-button>
    </div>

    <el-dialog
      v-model="inputDialogVisible"
      title="通用差异对比"
      width="86vw"
      align-center
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      class="general-diff-dialog"
    >
      <div class="general-diff-dialog__body">
        <section class="input-pane">
          <header class="input-pane__header">
            <span>原始文本</span>
            <span>{{ leftStats }}</span>
          </header>
          <div class="input-editor-wrap">
            <Codemirror
              v-model="leftInput"
              placeholder="粘贴第一份文本..."
              :style="{ height: '100%' }"
              :extensions="inputExtensions"
            />
          </div>
        </section>

        <section class="input-pane">
          <header class="input-pane__header">
            <span>对比文本</span>
            <span>{{ rightStats }}</span>
          </header>
          <div class="input-editor-wrap">
            <Codemirror
              v-model="rightInput"
              placeholder="粘贴第二份文本..."
              :style="{ height: '100%' }"
              :extensions="inputExtensions"
            />
          </div>
        </section>
      </div>

      <template #footer>
        <div class="general-diff-dialog__footer">
          <span>当前仅支持手动输入或粘贴文本内容</span>
          <el-button type="primary" @click="runCompare">开始对比</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { Codemirror } from 'vue-codemirror'
import { Compartment, type Extension } from '@codemirror/state'
import { EditorView, lineNumbers } from '@codemirror/view'
import { ElMessage } from 'element-plus'
import { CodeDiff } from 'v-code-diff'
import { diffLines, type Change } from 'diff'

interface TextMetrics {
  chars: number
  lines: number
}

interface CodeDiffResult {
  stat: {
    isChanged: boolean
    addNum: number
    delNum: number
  }
}

type DiffBarKind = 'insert' | 'delete' | 'replace'

interface RawDiffBarMark {
  kind: DiffBarKind
  startLine: number
  lineCount: number
}

interface DiffBarMark {
  kind: DiffBarKind
  top: number
  height: number
}

const LARGE_TEXT_CHAR_LIMIT = 300_000
const LARGE_TEXT_LINE_LIMIT = 10_000
const HARD_TEXT_CHAR_LIMIT = 2_500_000
const HARD_TEXT_LINE_LIMIT = 80_000
const MAX_DIFF_BAR_MARKS = 420

const pageRoot = ref<HTMLDivElement | null>(null)
const diffResultWrap = ref<HTMLDivElement | null>(null)
const inputDialogVisible = ref(false)
const leftInput = ref('')
const rightInput = ref('')
const comparedLeft = ref('')
const comparedRight = ref('')
const hasCompared = ref(false)
const isRenderingDiff = ref(false)
const compareVersion = ref(0)
const diffStat = ref<CodeDiffResult['stat'] | null>(null)
const comparedLeftMetrics = ref<TextMetrics>({ chars: 0, lines: 0 })
const comparedRightMetrics = ref<TextMetrics>({ chars: 0, lines: 0 })
const diffBarMarks = ref<DiffBarMark[]>([])
const diffOverviewBottomOffset = ref(0)
const leftStats = ref('0 行 / 0 字符')
const rightStats = ref('0 行 / 0 字符')

let leftStatsTimer: number | undefined
let rightStatsTimer: number | undefined
let renderTimer: number | undefined
let mainContentElement: HTMLElement | null = null
let previousMainPadding = ''
let previousMainPaddingVariable = ''

const languageCompartment = new Compartment()

const countLines = (text: string) => {
  if (!text) {
    return 0
  }

  let lineCount = 1
  for (let index = 0; index < text.length; index += 1) {
    if (text.charCodeAt(index) === 10) {
      lineCount += 1
    }
  }

  return lineCount
}

const measureText = (text: string): TextMetrics => ({
  chars: text.length,
  lines: countLines(text)
})

const formatMetrics = (metrics: TextMetrics) => {
  return `${metrics.lines.toLocaleString()} 行 / ${metrics.chars.toLocaleString()} 字符`
}

const getChangeLineCount = (change: Change) => {
  const value = change.value.replace(/\n$/, '')
  if (!value) {
    return 0
  }

  return value.split('\n').length
}

const getDiffBarPriority = (kind: DiffBarKind) => {
  if (kind === 'replace') {
    return 3
  }

  return 2
}

const toPercentMarks = (marks: RawDiffBarMark[], totalLines: number): DiffBarMark[] => {
  return marks.map(mark => ({
    kind: mark.kind,
    top: Math.max(0, Math.min(100, (mark.startLine / totalLines) * 100)),
    height: Math.max(0.45, Math.min(100, (mark.lineCount / totalLines) * 100))
  }))
}

const mergeRawDiffBarMarks = (marks: RawDiffBarMark[]) => {
  const merged: RawDiffBarMark[] = []

  marks.forEach(mark => {
    if (mark.lineCount <= 0) {
      return
    }

    const previous = merged[merged.length - 1]
    if (previous && previous.kind === mark.kind && mark.startLine <= previous.startLine + previous.lineCount + 1) {
      previous.lineCount = Math.max(previous.lineCount, mark.startLine + mark.lineCount - previous.startLine)
      return
    }

    merged.push({ ...mark })
  })

  return merged
}

const aggregateDiffBarMarks = (marks: RawDiffBarMark[], totalLines: number): DiffBarMark[] => {
  const buckets: Array<DiffBarKind | null> = Array.from({ length: MAX_DIFF_BAR_MARKS }, () => null)

  marks.forEach(mark => {
    const startBucket = Math.max(0, Math.floor((mark.startLine / totalLines) * MAX_DIFF_BAR_MARKS))
    const endBucket = Math.min(
      MAX_DIFF_BAR_MARKS - 1,
      Math.floor(((mark.startLine + mark.lineCount) / totalLines) * MAX_DIFF_BAR_MARKS)
    )

    for (let bucketIndex = startBucket; bucketIndex <= endBucket; bucketIndex += 1) {
      const current = buckets[bucketIndex]
      if (!current || getDiffBarPriority(mark.kind) >= getDiffBarPriority(current)) {
        buckets[bucketIndex] = mark.kind
      }
    }
  })

  const aggregated: RawDiffBarMark[] = []
  buckets.forEach((kind, bucketIndex) => {
    if (!kind) {
      return
    }

    const startLine = (bucketIndex / MAX_DIFF_BAR_MARKS) * totalLines
    const lineCount = totalLines / MAX_DIFF_BAR_MARKS
    const previous = aggregated[aggregated.length - 1]

    if (previous && previous.kind === kind) {
      previous.lineCount += lineCount
      return
    }

    aggregated.push({ kind, startLine, lineCount })
  })

  return toPercentMarks(aggregated, totalLines)
}

const buildDiffBarMarks = (oldText: string, newText: string): DiffBarMark[] => {
  const changes = diffLines(oldText, newText)
  const rawMarks: RawDiffBarMark[] = []
  let visualLine = 0

  for (let index = 0; index < changes.length; index += 1) {
    const change = changes[index]
    if (!change) {
      continue
    }

    const nextChange = changes[index + 1]
    const lineCount = getChangeLineCount(change)

    if (change.removed && nextChange?.added) {
      const nextLineCount = getChangeLineCount(nextChange)
      const pairedLineCount = Math.max(lineCount, nextLineCount)
      rawMarks.push({ kind: 'replace', startLine: visualLine, lineCount: pairedLineCount })
      visualLine += pairedLineCount
      index += 1
      continue
    }

    if (change.removed) {
      rawMarks.push({ kind: 'delete', startLine: visualLine, lineCount })
      visualLine += lineCount
      continue
    }

    if (change.added) {
      rawMarks.push({ kind: 'insert', startLine: visualLine, lineCount })
      visualLine += lineCount
      continue
    }

    visualLine += lineCount
  }

  const mergedMarks = mergeRawDiffBarMarks(rawMarks)
  if (!visualLine || mergedMarks.length === 0) {
    return []
  }

  if (mergedMarks.length > MAX_DIFF_BAR_MARKS) {
    return aggregateDiffBarMarks(mergedMarks, visualLine)
  }

  return toPercentMarks(mergedMarks, visualLine)
}

const syncDiffOverviewGeometry = () => {
  const scroller = diffResultWrap.value?.querySelector('.code-diff-view')
  if (!(scroller instanceof HTMLElement)) {
    return
  }

  const nextOffset = scroller.offsetHeight - scroller.clientHeight
  if (diffOverviewBottomOffset.value !== nextOffset) {
    diffOverviewBottomOffset.value = nextOffset
  }
}

const scheduleStatsUpdate = (side: 'left' | 'right', text: string) => {
  const update = () => {
    const stats = formatMetrics(measureText(text))
    if (side === 'left') {
      leftStats.value = stats
    } else {
      rightStats.value = stats
    }
  }

  if (side === 'left') {
    if (leftStatsTimer) {
      window.clearTimeout(leftStatsTimer)
    }
    leftStatsTimer = window.setTimeout(update, 160)
    return
  }

  if (rightStatsTimer) {
    window.clearTimeout(rightStatsTimer)
  }
  rightStatsTimer = window.setTimeout(update, 160)
}

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
  }
})

const inputExtensions: Extension[] = [
  editorTheme,
  lineNumbers(),
  EditorView.lineWrapping,
  languageCompartment.of([])
]

const totalComparedChars = computed(() => comparedLeftMetrics.value.chars + comparedRightMetrics.value.chars)
const totalComparedLines = computed(() => comparedLeftMetrics.value.lines + comparedRightMetrics.value.lines)

const isLargeComparison = computed(() => {
  return totalComparedChars.value > LARGE_TEXT_CHAR_LIMIT || totalComparedLines.value > LARGE_TEXT_LINE_LIMIT
})

const renderDiffStyle = computed<'word' | 'char'>(() => 'word')
const renderContext = computed(() => isLargeComparison.value ? 3 : 8)
const diffMaxHeight = computed(() => '100%')

const resultStats = computed(() => {
  if (!diffStat.value) {
    return `${formatMetrics(comparedLeftMetrics.value)} -> ${formatMetrics(comparedRightMetrics.value)}`
  }

  if (!diffStat.value.isChanged) {
    return '两份文本无差异'
  }

  return `新增 ${diffStat.value.addNum.toLocaleString()} 行，删除 ${diffStat.value.delNum.toLocaleString()} 行`
})

const openInputDialog = () => {
  inputDialogVisible.value = true
}

const runCompare = () => {
  const nextLeft = leftInput.value
  const nextRight = rightInput.value

  if (!nextLeft.trim() && !nextRight.trim()) {
    ElMessage.warning('请先输入或粘贴两份文本内容')
    return
  }

  const leftMetrics = measureText(nextLeft)
  const rightMetrics = measureText(nextRight)
  const totalChars = leftMetrics.chars + rightMetrics.chars
  const totalLines = leftMetrics.lines + rightMetrics.lines

  if (totalChars > HARD_TEXT_CHAR_LIMIT || totalLines > HARD_TEXT_LINE_LIMIT) {
    ElMessage.warning('文本过大，建议拆分后再对比，避免浏览器长时间无响应')
    return
  }

  if (renderTimer) {
    window.clearTimeout(renderTimer)
  }

  hasCompared.value = true
  isRenderingDiff.value = true
  inputDialogVisible.value = false
  comparedLeft.value = ''
  comparedRight.value = ''
  diffStat.value = null
  diffBarMarks.value = []
  diffOverviewBottomOffset.value = 0
  comparedLeftMetrics.value = leftMetrics
  comparedRightMetrics.value = rightMetrics

  renderTimer = window.setTimeout(() => {
    comparedLeft.value = nextLeft
    comparedRight.value = nextRight
    diffBarMarks.value = buildDiffBarMarks(nextLeft, nextRight)
    compareVersion.value += 1
  }, 16)
}

const handleDiffResult = async (result: CodeDiffResult) => {
  diffStat.value = result.stat
  await nextTick()
  syncDiffOverviewGeometry()
  isRenderingDiff.value = false
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

watch(leftInput, value => scheduleStatsUpdate('left', value))
watch(rightInput, value => scheduleStatsUpdate('right', value))

onMounted(() => {
  applyPagePadding()
  window.addEventListener('resize', syncDiffOverviewGeometry)
})

onUnmounted(() => {
  window.removeEventListener('resize', syncDiffOverviewGeometry)
  if (leftStatsTimer) {
    window.clearTimeout(leftStatsTimer)
  }
  if (rightStatsTimer) {
    window.clearTimeout(rightStatsTimer)
  }
  if (renderTimer) {
    window.clearTimeout(renderTimer)
  }
  restorePagePadding()
})
</script>

<style scoped>
.general-diff-page {
  position: relative;
  height: 100%;
  min-height: 0;
}

.result-pane {
  display: flex;
  height: 100%;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #ffffff;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
}

.result-pane__header {
  display: flex;
  min-height: 42px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
  padding: 7px 14px;
}

.result-pane__title-row {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 10px;
  white-space: nowrap;
}

.result-pane__title-row h2 {
  flex: 0 0 auto;
  margin: 0;
  color: #334155;
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
}

.result-pane__title-row p {
  min-width: 0;
  overflow: hidden;
  margin: 0;
  color: #64748b;
  font-size: 12px;
  line-height: 18px;
  text-overflow: ellipsis;
}

.result-pane__actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 8px;
}

.diff-result-wrap {
  position: relative;
  min-height: 0;
  flex: 1;
  overflow: hidden;
}

.result-pane__badge {
  border: 1px solid #fed7aa;
  border-radius: 999px;
  background: #fff7ed;
  padding: 2px 8px;
  color: #c2410c;
  font-size: 11px;
  font-weight: 700;
  line-height: 16px;
}

.result-pane__badge--side {
  border-color: #bfdbfe;
  background: #eff6ff;
  color: #1d4ed8;
}

.diff-result-empty {
  display: flex;
  height: 100%;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
  font-size: 13px;
}

.diff-overview-bar {
  position: absolute;
  top: 0;
  right: 0;
  z-index: 2;
  width: 14px;
  pointer-events: none;
}

.diff-overview-bar__mark {
  position: absolute;
  right: 2px;
  width: 10px;
  min-height: 3px;
  border-radius: 1px;
  opacity: 0.5;
}

.diff-overview-bar__mark--insert {
  background: #10b981;
}

.diff-overview-bar__mark--delete {
  background: #ef4444;
}

.diff-overview-bar__mark--replace {
  background: #f59e0b;
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

.general-diff-dialog :deep(.el-dialog) {
  max-width: 1320px;
}

.general-diff-dialog :deep(.el-dialog__body) {
  padding: 10px 18px 0;
}

.general-diff-dialog__body {
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

.general-diff-dialog__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
}

.general-diff-dialog__footer span {
  color: #64748b;
  font-size: 12px;
}

.diff-result-wrap :deep(.code-diff-view) {
  height: 100%;
  max-height: 100% !important;
  margin: 0;
  padding-right: 0px;
  border: 0;
  border-radius: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}

.diff-result-wrap :deep(.code-diff-view .file-header) {
  background: #f8fafc;
  border-bottom-color: #e2e8f0;
}

.diff-result-wrap :deep(.code-diff-view .diff-table .blob-code-inner),
.diff-result-wrap :deep(.code-diff-view .diff-table .blob-num) {
  font-size: 12px;
  line-height: 20px;
}

:deep(.cm-scroller::-webkit-scrollbar),
.diff-result-wrap :deep(.code-diff-view::-webkit-scrollbar) {
  width: 14px;
  height: 14px;
  background-color: transparent;
}

:deep(.cm-scroller::-webkit-scrollbar-track),
.diff-result-wrap :deep(.code-diff-view::-webkit-scrollbar-track) {
  background-color: transparent;
}

:deep(.cm-scroller::-webkit-scrollbar-thumb),
.diff-result-wrap :deep(.code-diff-view::-webkit-scrollbar-thumb) {
  border: 4px solid transparent;
  border-radius: 9999px;
  background-color: rgba(100, 116, 139, 0.8);
  background-clip: padding-box;
}

:deep(.cm-scroller::-webkit-scrollbar-thumb:hover),
.diff-result-wrap :deep(.code-diff-view::-webkit-scrollbar-thumb:hover) {
  background-color: rgba(71, 85, 105, 1);
}

:deep(.cm-scroller::-webkit-scrollbar-corner),
.diff-result-wrap :deep(.code-diff-view::-webkit-scrollbar-corner) {
  background-color: transparent;
}

@media (max-width: 900px) {
  .general-diff-dialog__body {
    grid-template-columns: 1fr;
    height: 76vh;
    min-height: 0;
  }

  .general-diff-page {
    height: auto;
    min-height: 100%;
  }

  .result-pane {
    min-height: 620px;
  }
}
</style>

<template>
  <div class="h-full flex flex-col gap-4" v-loading="loading" :element-loading-text="loadingText">

    <div class="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 min-h-0">
      <div class="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
        <div class="bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center justify-between">
          <span class="text-sm font-medium text-slate-600">原始 SECS 日志</span>
          <div class="flex items-center gap-2">
            <el-button size="small" type="primary" class="!rounded-md shadow-sm" :loading="loading" :disabled="loading" @click="onFormat">格式化</el-button>
            <el-button size="small" type="danger" plain class="!rounded-md" :disabled="loading" @click="onClear">清空</el-button>
          </div>
        </div>
        <div class="flex-1 overflow-hidden relative">
          <textarea
            ref="sourceTextareaRef"
            class="source-textarea w-full h-full absolute inset-0"
            placeholder="请输入原始日志..."
            :disabled="loading"
            spellcheck="false"
            wrap="off"
          />
        </div>
      </div>

      <div class="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
        <div class="bg-slate-50 border-b border-slate-200 px-4 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span class="text-sm font-medium text-slate-600">格式化结果</span>
          <div class="flex items-center gap-2 flex-wrap sm:justify-end">
            <span v-if="selectedPath" class="text-xs text-slate-400 font-mono max-w-[200px] truncate" :title="selectedPath">
              {{ '当前位置：' + selectedPath }}
            </span>
            <!-- <el-button size="small" class="!rounded-md" :disabled="loading || !hasFoldableLines" @click="onCollapseAll">全部收起</el-button>
            <el-button size="small" class="!rounded-md" :disabled="loading || !hasCollapsedLines" @click="onExpandAll">全部展开</el-button> -->
            <el-button size="small" class="!rounded-md" :disabled="loading || !formattedText" @click="onCopy">复制结果</el-button>
            <div class="flex items-center">
              <el-input
                v-model="locatePathInput"
                size="small"
                placeholder="输入路径，如 [0][2][2]"
                :disabled="loading"
                @keyup.enter="onLocateByPath"
                class="w-40 mr-2"
              />
              <el-button size="small" class="!rounded-md" :disabled="loading" @click="onLocateByPath">定位</el-button>
            </div>
          </div>
        </div>

        <div class="flex-1 overflow-hidden relative bg-slate-50/30">
          <Codemirror
            v-if="formattedText"
            v-model="formattedTextModel"
            :style="{ height: '100%' }"
            :extensions="outputExtensions"
            @ready="handleOutputReady"
          />
          <div v-else class="h-full flex items-center justify-center text-slate-400 text-sm">
            结果将在此显示...
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, shallowRef } from 'vue'
import { Codemirror } from 'vue-codemirror'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Compartment, EditorState } from '@codemirror/state'
import { Decoration, EditorView, lineNumbers } from '@codemirror/view'
import { consumeSecsSmlTransferText } from './secsSmlTransfer'

interface FormattedLineMeta {
  clickable: boolean
  path: string
  jumpToIndex?: number
  isClosing: boolean
}

type FormatWorkerMessage =
  | { type: 'success'; text: string; lineMeta: FormattedLineMeta[] }
  | { type: 'error'; message: string }

const sourceTextareaRef = ref<HTMLTextAreaElement | null>(null)
const route = useRoute()
const formattedText = ref('')
const formattedLines = ref<string[]>([])
const visibleFormattedText = ref('')
const formattedLineMeta = ref<FormattedLineMeta[]>([])
const visibleLineMeta = ref<VisibleFormattedLineMeta[]>([])
const selectedPath = ref('')
const selectedLineIndex = ref(-1)
const locatePathInput = ref('')
const loading = ref(false)
const loadingText = '正在格式化 SECS SML，请稍候...'
const outputViewRef = shallowRef<EditorView | null>(null)
const collapsedPaths = ref<Set<string>>(new Set())

let preferredPathLineMap = new Map<string, number>()
let fallbackPathLineMap = new Map<string, number>()
const foldableLineIndexes = ref<Set<number>>(new Set())
let sourceToVisibleLineMap = new Map<number, number>()

const highlightCompartment = new Compartment()
const foldCompartment = new Compartment()
const outputTheme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '14px',
    backgroundColor: 'transparent'
  },
  '.cm-scroller': {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    overflow: 'auto'
  },
  '.cm-content': {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    padding: '12px 0'
  },
  '.cm-line': {
    padding: '1px 12px 1px 34px',
    minHeight: '22px',
    position: 'relative',
    color: '#334155'
  },
  '.cm-foldable-line': {
    cursor: 'pointer'
  },
  '.cm-foldable-line::before': {
    position: 'absolute',
    left: '12px',
    top: '1px',
    width: '16px',
    lineHeight: '22px',
    color: '#64748b',
    fontSize: '12px',
    textAlign: 'center'
  },
  '.cm-fold-expanded::before': {
    content: '"▾"'
  },
  '.cm-fold-collapsed::before': {
    content: '"▸"'
  },
  '.cm-gutters': {
    backgroundColor: '#f8fafc',
    color: '#94a3b8',
    borderRight: '1px solid #e2e8f0'
  },
  '.cm-active-path-line': {
    backgroundColor: '#fde68a'
  },
  '&.cm-focused': {
    outline: 'none'
  }
})

interface VisibleFormattedLineMeta extends FormattedLineMeta {
  sourceLineIndex: number
  isFoldable: boolean
  isCollapsed: boolean
}

const hasFoldableLines = computed(() => foldableLineIndexes.value.size > 0)
const hasCollapsedLines = computed(() => collapsedPaths.value.size > 0)

function getSourceText() {
  return sourceTextareaRef.value?.value ?? ''
}

function removeTransferQueryFromUrl() {
  const url = new URL(window.location.href)
  url.searchParams.delete('source')
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
}

function rebuildPathLineMaps(lineMeta: FormattedLineMeta[]) {
  preferredPathLineMap = new Map<string, number>()
  fallbackPathLineMap = new Map<string, number>()
  const nextFoldableLineIndexes = new Set<number>()

  lineMeta.forEach((line, index) => {
    if (!line.path) return

    if (!fallbackPathLineMap.has(line.path)) {
      fallbackPathLineMap.set(line.path, index)
    }

    if (!line.isClosing && !preferredPathLineMap.has(line.path)) {
      preferredPathLineMap.set(line.path, index)
    }

    if (line.isClosing && typeof line.jumpToIndex === 'number') {
      nextFoldableLineIndexes.add(line.jumpToIndex)
    }
  })

  foldableLineIndexes.value = nextFoldableLineIndexes
}

function isDescendantPath(path: string, ancestorPath: string) {
  return path.startsWith(`${ancestorPath}[`)
}

function shouldHideLine(line: FormattedLineMeta) {
  if (!line.path) return false

  for (const collapsedPath of collapsedPaths.value) {
    if (line.path === collapsedPath && line.isClosing) return true
    if (isDescendantPath(line.path, collapsedPath)) return true
  }

  return false
}

function rebuildVisibleOutput() {
  const visibleLines: string[] = []
  const visibleMeta: VisibleFormattedLineMeta[] = []
  sourceToVisibleLineMap = new Map<number, number>()

  formattedLines.value.forEach((text, sourceLineIndex) => {
    const lineMeta = formattedLineMeta.value[sourceLineIndex]
    if (!lineMeta || shouldHideLine(lineMeta)) return

    const visibleLineIndex = visibleLines.length
    const isFoldable = foldableLineIndexes.value.has(sourceLineIndex)
    const isCollapsed = isFoldable && collapsedPaths.value.has(lineMeta.path)

    sourceToVisibleLineMap.set(sourceLineIndex, visibleLineIndex)
    visibleLines.push(text)
    visibleMeta.push({
      ...lineMeta,
      sourceLineIndex,
      isFoldable,
      isCollapsed
    })
  })

  visibleFormattedText.value = visibleLines.join('\n')
  visibleLineMeta.value = visibleMeta
}

function buildSelectedLineDecoration(view: EditorView, sourceLineIndex: number) {
  const visibleLineIndex = sourceToVisibleLineMap.get(sourceLineIndex) ?? -1
  const lineNumber = visibleLineIndex + 1
  if (lineNumber < 1 || lineNumber > view.state.doc.lines) {
    return Decoration.none
  }

  const lineData = view.state.doc.line(lineNumber)
  const highlight = Decoration.line({ attributes: { class: 'cm-active-path-line' } })
  return Decoration.set([highlight.range(lineData.from)], true)
}

function buildFoldLineDecorations(view: EditorView) {
  const ranges = visibleLineMeta.value.flatMap((line, visibleLineIndex) => {
    if (!line.isFoldable) return []

    const lineNumber = visibleLineIndex + 1
    if (lineNumber < 1 || lineNumber > view.state.doc.lines) return []

    const className = line.isCollapsed ? 'cm-foldable-line cm-fold-collapsed' : 'cm-foldable-line cm-fold-expanded'
    const lineData = view.state.doc.line(lineNumber)
    return [Decoration.line({ attributes: { class: className } }).range(lineData.from)]
  })

  return Decoration.set(ranges, true)
}

function syncOutputDecorations(shouldScroll = false) {
  const view = outputViewRef.value
  if (!view) return

  const effects = [
    highlightCompartment.reconfigure(EditorView.decorations.of(buildSelectedLineDecoration(view, selectedLineIndex.value))),
    foldCompartment.reconfigure(EditorView.decorations.of(buildFoldLineDecorations(view)))
  ]

  const visibleLineIndex = sourceToVisibleLineMap.get(selectedLineIndex.value) ?? -1
  const lineNumber = visibleLineIndex + 1
  if (shouldScroll && lineNumber >= 1 && lineNumber <= view.state.doc.lines) {
    effects.push(EditorView.scrollIntoView(view.state.doc.line(lineNumber).from, { y: 'center' }))
  }

  view.dispatch({ effects })
}

function getPathPrefixes(path: string) {
  const matches = path.match(/\[\d+\]/g) || []
  return matches.map((_, index) => matches.slice(0, index + 1).join(''))
}

function expandPathForLocate(path: string) {
  const nextCollapsedPaths = new Set(collapsedPaths.value)
  getPathPrefixes(path).forEach(pathPrefix => nextCollapsedPaths.delete(pathPrefix))
  collapsedPaths.value = nextCollapsedPaths
  rebuildVisibleOutput()
}

async function focusLine(
  lineIndex: number,
  path: string,
  messageText: string,
  shouldScroll = false,
  shouldExpandCollapsedParents = false
) {
  if (shouldExpandCollapsedParents) {
    expandPathForLocate(path)
  }

  selectedPath.value = path
  selectedLineIndex.value = lineIndex
  await nextTick()
  syncOutputDecorations(shouldScroll)

  if (messageText) {
    ElMessage({ type: 'success', message: messageText, duration: 1600 })
  }
}

function getLineMetaByNumber(lineNumber: number) {
  return visibleLineMeta.value[lineNumber - 1]
}

function getTargetLineIndex(lineNumber: number) {
  const line = getLineMetaByNumber(lineNumber)
  if (!line || !line.clickable) return -1

  return typeof line.jumpToIndex === 'number' ? line.jumpToIndex : line.sourceLineIndex
}

function getLineNumberFromMouseEvent(event: MouseEvent, view: EditorView) {
  const position = view.posAtCoords({ x: event.clientX, y: event.clientY })
  if (position == null) return -1
  return view.state.doc.lineAt(position).number
}

function isFoldToggleClick(event: MouseEvent, line: VisibleFormattedLineMeta) {
  if (!line.isFoldable) return false

  const lineElement = (event.target as HTMLElement | null)?.closest?.('.cm-line')
  if (!lineElement) return false

  const lineRect = lineElement.getBoundingClientRect()
  return event.clientX - lineRect.left <= 28
}

async function toggleFoldLine(line: VisibleFormattedLineMeta) {
  if (!line.isFoldable || !line.path) return

  const nextCollapsedPaths = new Set(collapsedPaths.value)
  if (nextCollapsedPaths.has(line.path)) {
    nextCollapsedPaths.delete(line.path)
  } else {
    nextCollapsedPaths.add(line.path)
  }

  collapsedPaths.value = nextCollapsedPaths
  rebuildVisibleOutput()
  await nextTick()
  syncOutputDecorations()
}

function handleOutputClick(event: MouseEvent, view: EditorView) {
  const lineNumber = getLineNumberFromMouseEvent(event, view)
  if (lineNumber < 1) return false

  const line = getLineMetaByNumber(lineNumber)
  if (!line || !line.clickable) return false

  if (isFoldToggleClick(event, line)) {
    event.preventDefault()
    event.stopPropagation()
    void toggleFoldLine(line)
    return true
  }

  const targetIndex = getTargetLineIndex(lineNumber)
  if (targetIndex < 0) return false

  void focusLine(targetIndex, line.path, `当前位置：${line.path}`)
  return false
}

function handleOutputDoubleClick(event: MouseEvent, view: EditorView) {
  const lineNumber = getLineNumberFromMouseEvent(event, view)
  if (lineNumber < 1) return false

  const line = getLineMetaByNumber(lineNumber)
  if (!line || !line.clickable || !line.path) return false

  if (isFoldToggleClick(event, line)) {
    event.preventDefault()
    event.stopPropagation()
    return true
  }

  const targetIndex = getTargetLineIndex(lineNumber)
  if (targetIndex >= 0) {
    void focusLine(targetIndex, line.path, `当前位置：${line.path}`)
  }

  navigator.clipboard.writeText(line.path)
    .then(() => {
      ElMessage.success('路径已复制')
    })
    .catch(() => {
      ElMessage.error('复制失败，请手动复制')
    })

  return false
}

const outputExtensions = [
  outputTheme,
  lineNumbers(),
  EditorState.readOnly.of(true),
  highlightCompartment.of(EditorView.decorations.of(Decoration.none)),
  foldCompartment.of(EditorView.decorations.of(Decoration.none)),
  EditorView.domEventHandlers({
    click(event, view) {
      return handleOutputClick(event, view)
    },
    dblclick(event, view) {
      return handleOutputDoubleClick(event, view)
    }
  })
]

const formattedTextModel = computed({
  get: () => visibleFormattedText.value,
  set: () => {}
})

function runFormatWorker(text: string) {
  return new Promise<{ text: string; lineMeta: FormattedLineMeta[] }>((resolve, reject) => {
    const worker = new Worker(new URL('./secsSmlFormatter.worker.ts', import.meta.url), { type: 'module' })

    const cleanup = () => {
      worker.onmessage = null
      worker.onerror = null
      worker.terminate()
    }

    worker.onmessage = (event: MessageEvent<FormatWorkerMessage>) => {
      cleanup()

      if (event.data.type === 'success') {
        resolve({ text: event.data.text, lineMeta: event.data.lineMeta })
        return
      }

      reject(new Error(event.data.message))
    }

    worker.onerror = (event) => {
      cleanup()
      reject(new Error(event.message || '格式化失败，请检查报文内容'))
    }

    worker.postMessage(text)
  })
}

function handleOutputReady(payload: { view: EditorView }) {
  outputViewRef.value = payload.view

  syncOutputDecorations()
}

async function onFormat() {
  const sourceText = getSourceText()
  if (!sourceText.trim()) {
    ElMessage.warning('请输入原始数据')
    return
  }

  if (loading.value) return

  loading.value = true
  formattedText.value = ''
  formattedLines.value = []
  visibleFormattedText.value = ''
  formattedLineMeta.value = []
  visibleLineMeta.value = []
  collapsedPaths.value = new Set()
  foldableLineIndexes.value = new Set()
  sourceToVisibleLineMap = new Map<number, number>()
  selectedPath.value = ''
  selectedLineIndex.value = -1

  try {
    await nextTick()
    const result = await runFormatWorker(sourceText)
    formattedText.value = result.text
    formattedLines.value = result.text ? result.text.split('\n') : []
    formattedLineMeta.value = result.lineMeta
    rebuildPathLineMaps(result.lineMeta)
    rebuildVisibleOutput()
    ElMessage.success('格式化完成')
  } catch (error) {
    formattedText.value = ''
    formattedLines.value = []
    visibleFormattedText.value = ''
    formattedLineMeta.value = []
    visibleLineMeta.value = []
    collapsedPaths.value = new Set()
    foldableLineIndexes.value = new Set()
    sourceToVisibleLineMap = new Map<number, number>()
    ElMessage.error(error instanceof Error ? error.message : '格式化失败，请检查报文内容')
  } finally {
    loading.value = false
  }
}

async function loadTransferredSourceText() {
  const sourceQuery = route.query.source
  const transferId = Array.isArray(sourceQuery) ? sourceQuery[0] : sourceQuery
  if (!transferId) {
    return
  }

  removeTransferQueryFromUrl()
  const transferredText = consumeSecsSmlTransferText(transferId)
  if (!transferredText) {
    ElMessage.warning('未找到待格式化的消息块内容')
    return
  }

  await nextTick()

  if (sourceTextareaRef.value) {
    sourceTextareaRef.value.value = transferredText
  }

  await onFormat()
}

function onClear() {
  if (loading.value) return

  if (sourceTextareaRef.value) {
    sourceTextareaRef.value.value = ''
  }

  formattedText.value = ''
  formattedLines.value = []
  visibleFormattedText.value = ''
  formattedLineMeta.value = []
  visibleLineMeta.value = []
  selectedPath.value = ''
  selectedLineIndex.value = -1
  locatePathInput.value = ''
  collapsedPaths.value = new Set()
  preferredPathLineMap = new Map<string, number>()
  fallbackPathLineMap = new Map<string, number>()
  foldableLineIndexes.value = new Set<number>()
  sourceToVisibleLineMap = new Map<number, number>()

  const view = outputViewRef.value
  if (view) {
    view.dispatch({
      effects: [
        highlightCompartment.reconfigure(EditorView.decorations.of(Decoration.none)),
        foldCompartment.reconfigure(EditorView.decorations.of(Decoration.none))
      ]
    })
  }
}

function normalizePath(raw: string) {
  return raw.replace(/[（）()\s]/g, '').trim()
}

async function onLocateByPath() {
  if (!formattedLineMeta.value.length) {
    ElMessage.warning('请先执行格式化')
    return
  }

  const normalized = normalizePath(locatePathInput.value || '')
  if (!/^(\[\d+\])+$/.test(normalized)) {
    ElMessage.warning('路径格式无效，请使用如 [0][2][2][1][0][0][0]')
    return
  }

  const targetIndex = preferredPathLineMap.get(normalized) ?? fallbackPathLineMap.get(normalized) ?? -1
  if (targetIndex < 0) {
    ElMessage.warning('未找到该位置，请确认路径是否正确')
    return
  }

  await focusLine(targetIndex, normalized, `已定位到：${normalized}`, true, true)
}

async function onCollapseAll() {
  if (!foldableLineIndexes.value.size) return

  const nextCollapsedPaths = new Set<string>()
  foldableLineIndexes.value.forEach(lineIndex => {
    const path = formattedLineMeta.value[lineIndex]?.path
    if (path) nextCollapsedPaths.add(path)
  })

  collapsedPaths.value = nextCollapsedPaths
  rebuildVisibleOutput()
  await nextTick()
  syncOutputDecorations()
}

async function onExpandAll() {
  if (!collapsedPaths.value.size) return

  collapsedPaths.value = new Set()
  rebuildVisibleOutput()
  await nextTick()
  syncOutputDecorations()
}

async function onCopy() {
  if (!formattedText.value) {
    ElMessage.warning('请先执行格式化')
    return
  }

  try {
    await navigator.clipboard.writeText(formattedText.value)
    ElMessage.success('已复制结果')
  } catch {
    ElMessage.error('复制失败，请手动复制')
  }
}

onMounted(() => {
  void loadTransferredSourceText()
})
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
  overflow: auto;
  overflow-wrap: normal;
  white-space: pre;
}

.source-textarea:disabled {
  cursor: not-allowed;
  color: rgb(100 116 139);
  background-color: rgb(248 250 252 / 0.7);
}
</style>

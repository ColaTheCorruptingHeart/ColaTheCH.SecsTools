<template>
  <div class="h-full flex flex-col gap-4" v-loading="loading" :element-loading-text="loadingText">
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
          <el-button size="small" type="primary" class="!rounded-md shadow-sm" :loading="loading" :disabled="loading" @click="onFormat">格式化</el-button>
          <el-button size="small" class="!rounded-md" :disabled="loading || !formattedText" @click="onCopy">复制结果</el-button>
          <div class="w-px h-4 bg-slate-300 mx-1"></div>
          <el-button size="small" type="danger" plain class="!rounded-md" :disabled="loading" @click="onClear">清空</el-button>

          <div class="flex items-center ml-2 border-l border-slate-300 pl-3">
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
    </div>

    <div class="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 min-h-0">
      <div class="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
        <div class="bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center justify-between">
          <span class="text-sm font-medium text-slate-600">原始 SECS 日志</span>
        </div>
        <div class="flex-1 overflow-hidden relative">
          <textarea
            ref="sourceTextareaRef"
            class="source-textarea w-full h-full absolute inset-0"
            placeholder="请输入原始日志..."
            :disabled="loading"
            spellcheck="false"
          />
        </div>
      </div>

      <div class="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
        <div class="bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center justify-between">
          <span class="text-sm font-medium text-slate-600">格式化结果</span>
          <span class="text-xs text-slate-400 font-mono hidden sm:inline-block max-w-[200px] truncate" :title="selectedPath">
            {{ selectedPath ? ('当前位置：' + selectedPath) : '点击任意结果行查看路径，双击可复制' }}
          </span>
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
        <div class="bg-slate-50 border-t border-slate-200 px-4 py-1.5 flex items-center justify-between shrink-0">
          <span class="text-xs text-slate-500">提示：点击结果行可查看路径并定位，双击可弹框并复制；也可输入路径直接定位。</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, shallowRef } from 'vue'
import { Codemirror } from 'vue-codemirror'
import { Document } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Compartment, EditorState } from '@codemirror/state'
import { Decoration, EditorView, lineNumbers } from '@codemirror/view'

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
const formattedText = ref('')
const formattedLineMeta = ref<FormattedLineMeta[]>([])
const selectedPath = ref('')
const selectedLineIndex = ref(-1)
const locatePathInput = ref('')
const loading = ref(false)
const loadingText = '正在格式化 SECS SML，请稍候...'
const outputViewRef = shallowRef<EditorView | null>(null)

let preferredPathLineMap = new Map<string, number>()
let fallbackPathLineMap = new Map<string, number>()

const highlightCompartment = new Compartment()
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
    padding: '1px 12px',
    minHeight: '22px',
    color: '#334155'
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

function getSourceText() {
  return sourceTextareaRef.value?.value ?? ''
}

function rebuildPathLineMaps(lineMeta: FormattedLineMeta[]) {
  preferredPathLineMap = new Map<string, number>()
  fallbackPathLineMap = new Map<string, number>()

  lineMeta.forEach((line, index) => {
    if (!line.path) return

    if (!fallbackPathLineMap.has(line.path)) {
      fallbackPathLineMap.set(line.path, index)
    }

    if (!line.isClosing && !preferredPathLineMap.has(line.path)) {
      preferredPathLineMap.set(line.path, index)
    }
  })
}

function buildSelectedLineDecoration(view: EditorView, lineIndex: number) {
  const lineNumber = lineIndex + 1
  if (lineNumber < 1 || lineNumber > view.state.doc.lines) {
    return Decoration.none
  }

  const lineData = view.state.doc.line(lineNumber)
  const highlight = Decoration.line({ attributes: { class: 'cm-active-path-line' } })
  return Decoration.set([highlight.range(lineData.from)], true)
}

async function focusLine(lineIndex: number, path: string, messageText: string, shouldScroll = false) {
  selectedPath.value = path
  selectedLineIndex.value = lineIndex
  await nextTick()

  const view = outputViewRef.value
  if (view) {
    const effects = [
      highlightCompartment.reconfigure(EditorView.decorations.of(buildSelectedLineDecoration(view, lineIndex)))
    ]

    const lineNumber = lineIndex + 1
    if (shouldScroll && lineNumber >= 1 && lineNumber <= view.state.doc.lines) {
      effects.push(EditorView.scrollIntoView(view.state.doc.line(lineNumber).from, { y: 'center' }))
    }

    view.dispatch({ effects })
  }

  if (messageText) {
    ElMessage({ type: 'success', message: messageText, duration: 1600 })
  }
}

function getLineMetaByNumber(lineNumber: number) {
  return formattedLineMeta.value[lineNumber - 1]
}

function getTargetLineIndex(lineNumber: number) {
  const line = getLineMetaByNumber(lineNumber)
  if (!line || !line.clickable) return -1

  return typeof line.jumpToIndex === 'number' ? line.jumpToIndex : lineNumber - 1
}

async function showCopiedPath(path: string, copied: boolean) {
  await ElMessageBox.alert(
    `<div class="mt-2 text-center text-lg font-mono text-amber-600 bg-amber-50 p-4 rounded-lg border border-amber-200">${path}</div>`,
    copied ? '位置已选择并自动复制' : '所选位置 (复制失败，请手动复制)',
    {
      dangerouslyUseHTMLString: true,
      confirmButtonText: '确定',
      type: copied ? 'success' : undefined,
      center: true
    }
  )
}

function getLineNumberFromMouseEvent(event: MouseEvent, view: EditorView) {
  const position = view.posAtCoords({ x: event.clientX, y: event.clientY })
  if (position == null) return -1
  return view.state.doc.lineAt(position).number
}

function handleOutputClick(event: MouseEvent, view: EditorView) {
  const lineNumber = getLineNumberFromMouseEvent(event, view)
  if (lineNumber < 1) return false

  const line = getLineMetaByNumber(lineNumber)
  if (!line || !line.clickable) return false

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

  const targetIndex = getTargetLineIndex(lineNumber)
  if (targetIndex >= 0) {
    void focusLine(targetIndex, line.path, `当前位置：${line.path}`)
  }

  navigator.clipboard.writeText(line.path)
    .then(() => showCopiedPath(line.path, true))
    .catch(() => showCopiedPath(line.path, false))

  return false
}

const outputExtensions = [
  outputTheme,
  lineNumbers(),
  EditorState.readOnly.of(true),
  highlightCompartment.of(EditorView.decorations.of(Decoration.none)),
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
  get: () => formattedText.value,
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

  if (selectedLineIndex.value >= 0) {
    void focusLine(selectedLineIndex.value, selectedPath.value, '')
  }
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
  formattedLineMeta.value = []
  selectedPath.value = ''
  selectedLineIndex.value = -1

  try {
    await nextTick()
    const result = await runFormatWorker(sourceText)
    formattedText.value = result.text
    formattedLineMeta.value = result.lineMeta
    rebuildPathLineMaps(result.lineMeta)
    ElMessage.success('格式化完成')
  } catch (error) {
    formattedText.value = ''
    formattedLineMeta.value = []
    ElMessage.error(error instanceof Error ? error.message : '格式化失败，请检查报文内容')
  } finally {
    loading.value = false
  }
}

function onClear() {
  if (loading.value) return

  if (sourceTextareaRef.value) {
    sourceTextareaRef.value.value = ''
  }

  formattedText.value = ''
  formattedLineMeta.value = []
  selectedPath.value = ''
  selectedLineIndex.value = -1
  locatePathInput.value = ''
  preferredPathLineMap = new Map<string, number>()
  fallbackPathLineMap = new Map<string, number>()

  const view = outputViewRef.value
  if (view) {
    view.dispatch({
      effects: highlightCompartment.reconfigure(EditorView.decorations.of(Decoration.none))
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

  await focusLine(targetIndex, normalized, `已定位到：${normalized}`, true)
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
</style>

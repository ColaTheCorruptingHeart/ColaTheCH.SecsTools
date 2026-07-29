<template>
  <div ref="pageRoot" class="secs-log-diff-page" v-loading="loading" element-loading-text="正在分析 SECS 日志...">
    <header class="topbar">
      <div class="topbar__title">
        <h1>SECS 日志语义差异</h1>
        <p>{{ resultSummary }}</p>
      </div>
      <div class="topbar__actions">
        <el-tag effect="plain">{{ activeProfile.name }}</el-tag>
        <el-tag v-if="viewportHighlightEnabled" type="warning" effect="plain">视口高亮</el-tag>
        <el-button size="small" plain @click="ruleDialogVisible = true">规则配置</el-button>
        <el-button size="small" plain @click="exportProfile">导出规则</el-button>
        <el-button size="small" plain @click="inputDialogVisible = true">导入/输入日志</el-button>
        <el-button size="small" type="primary" :disabled="!canAnalyze" :loading="loading" @click="runAnalyze">重新分析</el-button>
      </div>
    </header>

    <div v-if="result" class="workbench">
      <DiffNavigator
        ref="diffNavigatorRef"
        :rows="result.rows"
        :selected-row-id="selectedRowId"
        :filter="diffFilter"
        @select="selectRow"
        @open-detail="openRowDetail"
        @update:filter="diffFilter = $event"
      />

      <main class="diff-main">
        <div v-if="result.warnings.length" class="warning-strip">
          <span v-for="warning in result.warnings" :key="warning">{{ warning }}</span>
        </div>

        <div class="diff-editors">
          <section class="diff-pane">
            <header class="diff-pane__header">
              <div>
                <h2>Baseline</h2>
                <p>{{ baselineStats }}</p>
              </div>
              <span class="diff-pane__badge diff-pane__badge--baseline">BASE</span>
            </header>
            <div class="editor-wrap">
              <Codemirror
                v-model="baselineDisplayText"
                :style="{ height: '100%' }"
                :extensions="baselineExtensions"
                @ready="handleBaselineReady"
              />
            </div>
          </section>

          <section class="diff-pane">
            <header class="diff-pane__header">
              <div>
                <h2>Target</h2>
                <p>{{ targetStats }}</p>
              </div>
              <span class="diff-pane__badge diff-pane__badge--target">TARGET</span>
            </header>
            <div class="editor-wrap">
              <Codemirror
                v-model="targetDisplayText"
                :style="{ height: '100%' }"
                :extensions="targetExtensions"
                @ready="handleTargetReady"
              />
            </div>
          </section>
        </div>

        <footer class="statusbar">
          <span>消息 {{ result.stats.baselineMessages.toLocaleString() }} / {{ result.stats.targetMessages.toLocaleString() }}</span>
          <span>差异 {{ result.stats.diffRows.toLocaleString() }}</span>
          <span>新增 {{ result.stats.added.toLocaleString() }}</span>
          <span>缺失 {{ result.stats.missing.toLocaleString() }}</span>
          <span>变化 {{ result.stats.changed.toLocaleString() }}</span>
          <span>字段 {{ result.stats.fieldChanged.toLocaleString() }}</span>
          <span>ACK {{ result.stats.ackError.toLocaleString() }}</span>
        </footer>
      </main>
    </div>

    <div v-else class="empty-state">
      <div>
        <h2>导入两份 SECS/SML 作业日志</h2>
        <p>  </p>
        <el-button type="primary" @click="inputDialogVisible = true">开始分析</el-button>
      </div>
    </div>

    <DiffInputDialog
      v-model="inputDialogVisible"
      v-model:baseline-text="baselineInput"
      v-model:target-text="targetInput"
      v-model:include-equal-rows="includeEqualRows"
      :loading="loading"
      :extensions="inputExtensions"
      @analyze="runAnalyze"
      @clear="clearInputs"
    />

    <DiffDetailDrawer v-model="detailVisible" :row="selectedRow" />
    <RuleConfigDialog
      v-model="ruleDialogVisible"
      :profile="activeProfile"
      @apply="applyProfile"
      @export="exportProfile"
    />

    <div
      v-if="blockContextMenu.visible"
      class="diff-block-context-menu"
      :style="{ left: blockContextMenu.left + 'px', top: blockContextMenu.top + 'px' }"
      @click.stop
      @contextmenu.prevent.stop
    >
      <button
        class="diff-block-context-menu__item"
        type="button"
        :disabled="!blockContextMenu.selectedText"
        @click="copyContextMenuSelectedText"
      >
        复制选中内容
      </button>
      <button class="diff-block-context-menu__item" type="button" @click="copyContextMenuMessageBlock">
        复制消息块
      </button>
      <button class="diff-block-context-menu__item" type="button" @click="copyContextMenuFormattedMessageBlock">
        复制格式化消息块
      </button>
      <button class="diff-block-context-menu__item" type="button" @click="sendContextMenuMessageBlockToSecsSmlFormatter">
        发送至SML格式化
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef, toRaw, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Codemirror } from 'vue-codemirror'
import { Compartment, EditorState, type Extension, type Range, type Text } from '@codemirror/state'
import { Decoration, EditorView, lineNumbers } from '@codemirror/view'
import { ElMessage } from 'element-plus'
import { DEFAULT_SECS_LOG_DIFF_OPTIONS } from './secs-log-diff/config'
import { SECS_LOG_DIFF_LIMITS } from './secs-log-diff/config'
import { cloneDefaultProfile } from './secs-log-diff/rules'
import { formatSecsSml } from './secs-log/sml'
import { discardSecsSmlTransferText, storeSecsSmlTransferText } from './secsSmlTransfer'
import type {
  SecsDiffRenderRow,
  SecsLogDiffKind,
  SecsLogDiffSide,
  SecsLogDiffResult,
  SecsLogDiffProfile,
  SecsLogDiffWorkerRequest,
  SecsLogDiffWorkerResponse
} from './secs-log-diff/types'
import DiffDetailDrawer from './secs-log-diff/components/DiffDetailDrawer.vue'
import DiffInputDialog from './secs-log-diff/components/DiffInputDialog.vue'
import DiffNavigator from './secs-log-diff/components/DiffNavigator.vue'
import RuleConfigDialog from './secs-log-diff/components/RuleConfigDialog.vue'

const router = useRouter()
const pageRoot = ref<HTMLDivElement | null>(null)
const inputDialogVisible = ref(false)
const detailVisible = ref(false)
const ruleDialogVisible = ref(false)
const loading = ref(false)
const baselineInput = ref('')
const targetInput = ref('')
const baselineDisplayText = ref('')
const targetDisplayText = ref('')
const result = shallowRef<SecsLogDiffResult | null>(null)
const selectedRowId = ref('')
const diffFilter = ref<SecsLogDiffKind | 'all'>('all')
const includeEqualRows = ref(DEFAULT_SECS_LOG_DIFF_OPTIONS.includeEqualRows)
const activeProfile = ref<SecsLogDiffProfile>(cloneDefaultProfile())
const diffNavigatorRef = ref<InstanceType<typeof DiffNavigator> | null>(null)
const baselineViewRef = shallowRef<EditorView>()
const targetViewRef = shallowRef<EditorView>()
const hoveredRowId = ref('')
const flashingRowId = ref('')
const blockContextMenu = ref<{
  visible: boolean
  left: number
  top: number
  row: SecsDiffRenderRow | null
  side: SecsLogDiffSide
  selectedText: string
}>({
  visible: false,
  left: 0,
  top: 0,
  row: null,
  side: 'baseline',
  selectedText: ''
})

let mainContentElement: HTMLElement | null = null
let previousMainPadding = ''
let previousMainPaddingVariable = ''
let activeWorker: Worker | null = null
let syncingScroll = false
let highlightFrame: number | undefined
let flashTimer: number | undefined
let autoOpenDialogTimer: number | undefined

const baselineDecorationCompartment = new Compartment()
const targetDecorationCompartment = new Compartment()
const VIEWPORT_HIGHLIGHT_OVERSCAN_LINES = 160

const selectedRow = computed(() => {
  if (!result.value || !selectedRowId.value) {
    return null
  }

  return result.value.rows.find(row => row.id === selectedRowId.value) || null
})

const canAnalyze = computed(() => Boolean(baselineInput.value.trim() || targetInput.value.trim()))

const resultSummary = computed(() => {
  if (!result.value) {
    return '等待导入 baseline 与 target'
  }

  const stats = result.value.stats
  return `${stats.baselineMessages.toLocaleString()} -> ${stats.targetMessages.toLocaleString()} messages, ${stats.diffRows.toLocaleString()} differences`
})

const baselineStats = computed(() => {
  if (!result.value) {
    return '等待分析'
  }

  return `${result.value.stats.baselineLines.toLocaleString()} 行，${result.value.stats.baselineMessages.toLocaleString()} 消息`
})

const targetStats = computed(() => {
  if (!result.value) {
    return '等待分析'
  }

  return `${result.value.stats.targetLines.toLocaleString()} 行，${result.value.stats.targetMessages.toLocaleString()} 消息`
})

const viewportHighlightEnabled = computed(() => {
  return Boolean(result.value && result.value.stats.diffRows > SECS_LOG_DIFF_LIMITS.maxHighlightRows)
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
  '.cm-secs-added': {
    backgroundColor: 'rgba(16, 185, 129, 0.16) !important',
    boxShadow: 'inset 3px 0 0 #10b981'
  },
  '.cm-secs-missing': {
    backgroundColor: 'rgba(239, 68, 68, 0.14) !important',
    boxShadow: 'inset 3px 0 0 #ef4444'
  },
  '.cm-secs-changed': {
    backgroundColor: 'rgba(245, 158, 11, 0.16) !important',
    boxShadow: 'inset 3px 0 0 #f59e0b'
  },
  '.cm-secs-ack-error': {
    backgroundColor: 'rgba(220, 38, 38, 0.18) !important',
    boxShadow: 'inset 3px 0 0 #dc2626'
  },
  '.cm-secs-parse-error': {
    backgroundColor: 'rgba(139, 92, 246, 0.16) !important',
    boxShadow: 'inset 3px 0 0 #8b5cf6'
  },
  '.cm-secs-hover': {
    backgroundColor: 'rgba(14, 165, 233, 0.14) !important',
    boxShadow: 'inset 3px 0 0 #0ea5e9'
  },
  '.cm-secs-added.cm-secs-hover': {
    backgroundColor: 'rgba(16, 185, 129, 0.24) !important',
    boxShadow: 'inset 3px 0 0 #059669'
  },
  '.cm-secs-missing.cm-secs-hover': {
    backgroundColor: 'rgba(239, 68, 68, 0.22) !important',
    boxShadow: 'inset 3px 0 0 #dc2626'
  },
  '.cm-secs-changed.cm-secs-hover': {
    backgroundColor: 'rgba(245, 158, 11, 0.25) !important',
    boxShadow: 'inset 3px 0 0 #d97706'
  },
  '.cm-secs-ack-error.cm-secs-hover': {
    backgroundColor: 'rgba(220, 38, 38, 0.26) !important',
    boxShadow: 'inset 3px 0 0 #b91c1c'
  },
  '.cm-secs-parse-error.cm-secs-hover': {
    backgroundColor: 'rgba(139, 92, 246, 0.24) !important',
    boxShadow: 'inset 3px 0 0 #7c3aed'
  },
  '.cm-secs-flash': {
    animation: 'secs-diff-flash 0.55s ease-in-out 3'
  },
  '.cm-secs-added.cm-secs-flash': {
    animation: 'secs-diff-flash-added 0.55s ease-in-out 3'
  },
  '.cm-secs-missing.cm-secs-flash': {
    animation: 'secs-diff-flash-missing 0.55s ease-in-out 3'
  },
  '.cm-secs-changed.cm-secs-flash': {
    animation: 'secs-diff-flash-changed 0.55s ease-in-out 3'
  },
  '.cm-secs-ack-error.cm-secs-flash': {
    animation: 'secs-diff-flash-ack-error 0.55s ease-in-out 3'
  },
  '.cm-secs-parse-error.cm-secs-flash': {
    animation: 'secs-diff-flash-parse-error 0.55s ease-in-out 3'
  },
  '@keyframes secs-diff-flash': {
    '0%, 100%': {
      backgroundColor: 'rgba(14, 165, 233, 0.10)'
    },
    '50%': {
      backgroundColor: 'rgba(14, 165, 233, 0.34)',
      boxShadow: 'inset 3px 0 0 #0284c7'
    }
  },
  '@keyframes secs-diff-flash-added': {
    '0%, 100%': {
      backgroundColor: 'rgba(16, 185, 129, 0.14)'
    },
    '50%': {
      backgroundColor: 'rgba(16, 185, 129, 0.34)',
      boxShadow: 'inset 3px 0 0 #059669'
    }
  },
  '@keyframes secs-diff-flash-missing': {
    '0%, 100%': {
      backgroundColor: 'rgba(239, 68, 68, 0.12)'
    },
    '50%': {
      backgroundColor: 'rgba(239, 68, 68, 0.32)',
      boxShadow: 'inset 3px 0 0 #dc2626'
    }
  },
  '@keyframes secs-diff-flash-changed': {
    '0%, 100%': {
      backgroundColor: 'rgba(245, 158, 11, 0.14)'
    },
    '50%': {
      backgroundColor: 'rgba(245, 158, 11, 0.34)',
      boxShadow: 'inset 3px 0 0 #d97706'
    }
  },
  '@keyframes secs-diff-flash-ack-error': {
    '0%, 100%': {
      backgroundColor: 'rgba(220, 38, 38, 0.14)'
    },
    '50%': {
      backgroundColor: 'rgba(220, 38, 38, 0.36)',
      boxShadow: 'inset 3px 0 0 #b91c1c'
    }
  },
  '@keyframes secs-diff-flash-parse-error': {
    '0%, 100%': {
      backgroundColor: 'rgba(139, 92, 246, 0.14)'
    },
    '50%': {
      backgroundColor: 'rgba(139, 92, 246, 0.34)',
      boxShadow: 'inset 3px 0 0 #7c3aed'
    }
  }
})

const inputExtensions: Extension[] = [
  editorTheme,
  lineNumbers(),
  EditorView.lineWrapping
]

const baselineExtensions: Extension[] = [
  editorTheme,
  lineNumbers(),
  EditorState.readOnly.of(true),
  baselineDecorationCompartment.of(EditorView.decorations.of(Decoration.none)),
  EditorView.domEventHandlers({
    mousemove(event, view) {
      return handleEditorMouseMove(event, view, 'baseline')
    },
    click(event, view) {
      return handleEditorClick(event, view, 'baseline')
    },
    dblclick(event, view) {
      return handleEditorDoubleClick(event, view, 'baseline')
    },
    contextmenu(event, view) {
      return handleEditorContextMenu(event, view, 'baseline')
    },
    mouseleave() {
      if (!blockContextMenu.value.visible) {
        clearHoveredRow()
      }
      return false
    }
  })
]

const targetExtensions: Extension[] = [
  editorTheme,
  lineNumbers(),
  EditorState.readOnly.of(true),
  targetDecorationCompartment.of(EditorView.decorations.of(Decoration.none)),
  EditorView.domEventHandlers({
    mousemove(event, view) {
      return handleEditorMouseMove(event, view, 'target')
    },
    click(event, view) {
      return handleEditorClick(event, view, 'target')
    },
    dblclick(event, view) {
      return handleEditorDoubleClick(event, view, 'target')
    },
    contextmenu(event, view) {
      return handleEditorContextMenu(event, view, 'target')
    },
    mouseleave() {
      if (!blockContextMenu.value.visible) {
        clearHoveredRow()
      }
      return false
    }
  })
]

function getRowClasses(row: SecsDiffRenderRow, side: 'baseline' | 'target') {
  const classes: string[] = []

  if (row.kind === 'added') {
    if (side === 'target') classes.push('cm-secs-added')
  } else if (row.kind === 'missing') {
    if (side === 'baseline') classes.push('cm-secs-missing')
  } else if (row.kind === 'changed' || row.kind === 'field_changed') {
    classes.push('cm-secs-changed')
  } else if (row.kind === 'ack_error') {
    classes.push('cm-secs-ack-error')
  } else if (row.kind === 'parse_error') {
    classes.push('cm-secs-parse-error')
  }

  if (row.id === hoveredRowId.value) {
    classes.push('cm-secs-hover')
  }

  if (row.id === flashingRowId.value) {
    classes.push('cm-secs-flash')
  }

  return classes.join(' ')
}

function getViewportLineRange(view: EditorView) {
  if (!viewportHighlightEnabled.value || !view.visibleRanges.length) {
    return null
  }

  const firstRange = view.visibleRanges[0]
  const lastRange = view.visibleRanges[view.visibleRanges.length - 1]
  if (!firstRange || !lastRange) {
    return null
  }

  return {
    start: Math.max(1, view.state.doc.lineAt(firstRange.from).number - VIEWPORT_HIGHLIGHT_OVERSCAN_LINES),
    end: Math.min(view.state.doc.lines, view.state.doc.lineAt(lastRange.to).number + VIEWPORT_HIGHLIGHT_OVERSCAN_LINES)
  }
}

function rowIntersectsLineRange(row: SecsDiffRenderRow, side: 'baseline' | 'target', lineRange: { start: number, end: number } | null) {
  if (!lineRange || row.id === hoveredRowId.value || row.id === flashingRowId.value) {
    return true
  }

  const { start, end } = getRowDisplayRange(row, side)
  return start <= lineRange.end && end >= lineRange.start
}

function getRowDisplayRange(row: SecsDiffRenderRow, side: 'baseline' | 'target') {
  const start = side === 'baseline' ? row.baselineDisplayStartLine : row.targetDisplayStartLine
  const end = side === 'baseline' ? row.baselineDisplayEndLine : row.targetDisplayEndLine
  return { start, end }
}

function getHighlightCandidateRows(rows: SecsDiffRenderRow[], side: 'baseline' | 'target', lineRange: { start: number, end: number } | null) {
  if (!lineRange) {
    return rows
  }

  let low = 0
  let high = rows.length
  while (low < high) {
    const middle = Math.floor((low + high) / 2)
    const row = rows[middle]
    if (!row || getRowDisplayRange(row, side).end < lineRange.start) {
      low = middle + 1
    } else {
      high = middle
    }
  }

  const candidates: SecsDiffRenderRow[] = []
  for (let index = low; index < rows.length; index += 1) {
    const row = rows[index]
    if (!row) {
      continue
    }

    const range = getRowDisplayRange(row, side)
    if (range.start > lineRange.end) {
      break
    }

    candidates.push(row)
  }

  ;[hoveredRowId.value, flashingRowId.value].forEach(rowId => {
    const transientRow = rowId ? rows.find(row => row.id === rowId) : undefined
    if (transientRow && !candidates.some(row => row.id === transientRow.id)) {
      candidates.push(transientRow)
    }
  })

  return candidates
}

function createDecorations(side: 'baseline' | 'target', view: EditorView) {
  const doc: Text = view.state.doc
  const rows = result.value?.rows || []
  const builder: Array<Range<Decoration>> = []
  const visibleLineRange = getViewportLineRange(view)
  const candidateRows = getHighlightCandidateRows(rows, side, visibleLineRange)

  candidateRows.forEach(row => {
    if (!rowIntersectsLineRange(row, side, visibleLineRange)) {
      return
    }

    const className = getRowClasses(row, side)
    if (!className) {
      return
    }

    const start = side === 'baseline' ? row.baselineDisplayStartLine : row.targetDisplayStartLine
    const end = side === 'baseline' ? row.baselineDisplayEndLine : row.targetDisplayEndLine
    const lineDecoration = Decoration.line({ attributes: { class: className } })

    for (let lineNumber = start; lineNumber <= end && lineNumber <= doc.lines; lineNumber += 1) {
      builder.push(lineDecoration.range(doc.line(lineNumber).from))
    }
  })

  builder.sort((left, right) => left.from - right.from)
  return Decoration.set(builder, true)
}

function updateHighlights() {
  if (baselineViewRef.value) {
    baselineViewRef.value.dispatch({
      effects: baselineDecorationCompartment.reconfigure(
        EditorView.decorations.of(createDecorations('baseline', baselineViewRef.value))
      )
    })
  }

  if (targetViewRef.value) {
    targetViewRef.value.dispatch({
      effects: targetDecorationCompartment.reconfigure(
        EditorView.decorations.of(createDecorations('target', targetViewRef.value))
      )
    })
  }
}

function scheduleHighlightsUpdate() {
  if (!viewportHighlightEnabled.value) {
    return
  }

  if (highlightFrame !== undefined) {
    return
  }

  highlightFrame = window.requestAnimationFrame(() => {
    highlightFrame = undefined
    updateHighlights()
  })
}

function syncScroll(source: EditorView, target: EditorView) {
  if (syncingScroll) {
    return
  }

  syncingScroll = true
  const sourceScroll = source.scrollDOM
  const targetScroll = target.scrollDOM
  const sourceMax = Math.max(1, sourceScroll.scrollHeight - sourceScroll.clientHeight)
  const targetMax = Math.max(0, targetScroll.scrollHeight - targetScroll.clientHeight)
  targetScroll.scrollTop = (sourceScroll.scrollTop / sourceMax) * targetMax
  targetScroll.scrollLeft = sourceScroll.scrollLeft
  window.requestAnimationFrame(() => {
    syncingScroll = false
  })
}

function handleEditorScroll(source: EditorView, target: EditorView) {
  scheduleHighlightsUpdate()
  syncScroll(source, target)
}

function attachScrollSync() {
  const baselineView = baselineViewRef.value
  const targetView = targetViewRef.value
  if (!baselineView || !targetView) {
    return
  }

  baselineView.scrollDOM.onscroll = () => handleEditorScroll(baselineView, targetView)
  targetView.scrollDOM.onscroll = () => handleEditorScroll(targetView, baselineView)
}

function handleBaselineReady(payload: { view: EditorView }) {
  baselineViewRef.value = payload.view
  attachScrollSync()
  updateHighlights()
}

function handleTargetReady(payload: { view: EditorView }) {
  targetViewRef.value = payload.view
  attachScrollSync()
  updateHighlights()
}

function scrollViewToLine(view: EditorView | undefined, lineNumber: number) {
  if (!view || lineNumber < 1 || lineNumber > view.state.doc.lines) {
    return
  }

  const lineData = view.state.doc.line(lineNumber)
  view.dispatch({
    selection: { anchor: lineData.from },
    effects: EditorView.scrollIntoView(lineData.from, { y: 'center' })
  })
}

function getLineNumberFromMouseEvent(event: MouseEvent, view: EditorView) {
  const position = view.posAtCoords({ x: event.clientX, y: event.clientY })
  if (position == null) {
    return -1
  }

  return view.state.doc.lineAt(position).number
}

function findRowByDisplayLine(side: 'baseline' | 'target', lineNumber: number) {
  const rows = result.value?.rows || []
  let low = 0
  let high = rows.length - 1

  while (low <= high) {
    const middle = Math.floor((low + high) / 2)
    const row = rows[middle]
    if (!row) {
      break
    }

    const range = getRowDisplayRange(row, side)
    if (lineNumber < range.start) {
      high = middle - 1
    } else if (lineNumber > range.end) {
      low = middle + 1
    } else {
      return row
    }
  }

  return null
}

function getRowFromEditorMouseEvent(event: MouseEvent, view: EditorView, side: 'baseline' | 'target') {
  const lineNumber = getLineNumberFromMouseEvent(event, view)
  if (lineNumber < 1) {
    return null
  }

  return findRowByDisplayLine(side, lineNumber)
}

function updateHoveredRow(rowId: string) {
  if (hoveredRowId.value === rowId) {
    return
  }

  hoveredRowId.value = rowId
  updateHighlights()
}

function clearHoveredRow() {
  updateHoveredRow('')
}

function triggerEditorFlash(rowId: string) {
  if (flashTimer !== undefined) {
    window.clearTimeout(flashTimer)
    flashTimer = undefined
  }

  flashingRowId.value = ''
  updateHighlights()

  window.requestAnimationFrame(() => {
    flashingRowId.value = rowId
    updateHighlights()
    flashTimer = window.setTimeout(() => {
      if (flashingRowId.value === rowId) {
        flashingRowId.value = ''
        updateHighlights()
      }
      flashTimer = undefined
    }, 1800)
  })
}

function handleEditorMouseMove(event: MouseEvent, view: EditorView, side: 'baseline' | 'target') {
  const row = getRowFromEditorMouseEvent(event, view, side)
  updateHoveredRow(row?.id || '')
  return false
}

function handleEditorClick(event: MouseEvent, view: EditorView, side: 'baseline' | 'target') {
  const row = getRowFromEditorMouseEvent(event, view, side)
  if (!row || row.kind === 'equal') {
    return false
  }

  selectRowFromEditor(row.id)
  return true
}

function handleEditorDoubleClick(event: MouseEvent, view: EditorView, side: 'baseline' | 'target') {
  const row = getRowFromEditorMouseEvent(event, view, side)
  if (!row || row.kind === 'equal') {
    return false
  }

  openRowDetail(row.id)
  return true
}

function getSelectedText(view: EditorView) {
  const ranges = view.state.selection.ranges.filter(range => !range.empty)
  if (!ranges.length) {
    return ''
  }

  return ranges
    .map(range => view.state.doc.sliceString(range.from, range.to))
    .join('\n')
}

function getContextMenuPosition(event: MouseEvent) {
  const menuWidth = 156
  const menuHeight = 152
  const margin = 8

  return {
    left: Math.max(margin, Math.min(event.clientX, window.innerWidth - menuWidth - margin)),
    top: Math.max(margin, Math.min(event.clientY, window.innerHeight - menuHeight - margin))
  }
}

function getRowSideText(row: SecsDiffRenderRow, side: SecsLogDiffSide) {
  const text = side === 'baseline' ? row.baselineText : row.targetText
  return text.trimEnd()
}

function closeBlockContextMenu() {
  if (!blockContextMenu.value.visible) {
    return
  }

  blockContextMenu.value = {
    visible: false,
    left: 0,
    top: 0,
    row: null,
    side: 'baseline',
    selectedText: ''
  }
}

function handleEditorContextMenu(event: MouseEvent, view: EditorView, side: SecsLogDiffSide) {
  const row = getRowFromEditorMouseEvent(event, view, side)
  const text = row ? getRowSideText(row, side) : ''
  if (!row || !text) {
    closeBlockContextMenu()
    return false
  }

  event.preventDefault()
  event.stopPropagation()
  updateHoveredRow(row.id)

  const position = getContextMenuPosition(event)
  blockContextMenu.value = {
    visible: true,
    left: position.left,
    top: position.top,
    row,
    side,
    selectedText: getSelectedText(view)
  }

  return true
}

async function copyTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textArea = document.createElement('textarea')
  textArea.value = text
  textArea.style.position = 'fixed'
  textArea.style.left = '-9999px'
  document.body.appendChild(textArea)
  textArea.focus()
  textArea.select()

  try {
    document.execCommand('copy')
  } finally {
    document.body.removeChild(textArea)
  }
}

function getContextMenuMessageText() {
  const row = blockContextMenu.value.row
  if (!row) {
    return ''
  }

  return getRowSideText(row, blockContextMenu.value.side)
}

async function copyContextMenuSelectedText() {
  const text = blockContextMenu.value.selectedText
  if (!text) {
    closeBlockContextMenu()
    ElMessage.warning('当前没有选中内容，无法复制')
    return
  }

  try {
    await copyTextToClipboard(text)
    ElMessage.success('选中内容已复制')
  } catch {
    ElMessage.error('复制失败，请手动复制')
  } finally {
    closeBlockContextMenu()
  }
}

async function copyContextMenuMessageBlock() {
  const text = getContextMenuMessageText()
  if (!text) {
    closeBlockContextMenu()
    ElMessage.warning('当前消息块为空，无法复制')
    return
  }

  try {
    await copyTextToClipboard(text)
    ElMessage.success('消息块已复制')
  } catch {
    ElMessage.error('复制失败，请手动复制')
  } finally {
    closeBlockContextMenu()
  }
}

async function copyContextMenuFormattedMessageBlock() {
  const text = getContextMenuMessageText()
  if (!text) {
    closeBlockContextMenu()
    ElMessage.warning('当前消息块为空，无法复制')
    return
  }

  const formattedText = formatSecsSml(text).text
  if (!formattedText) {
    closeBlockContextMenu()
    ElMessage.warning('当前消息块无法格式化')
    return
  }

  try {
    await copyTextToClipboard(formattedText)
    ElMessage.success('格式化消息块已复制')
  } catch {
    ElMessage.error('复制失败，请手动复制')
  } finally {
    closeBlockContextMenu()
  }
}

function sendContextMenuMessageBlockToSecsSmlFormatter() {
  const text = getContextMenuMessageText()
  if (!text) {
    closeBlockContextMenu()
    ElMessage.warning('当前消息块为空，无法发送')
    return
  }

  try {
    const transferId = storeSecsSmlTransferText(text)
    const route = router.resolve({
      path: '/tools/secs-sml',
      query: { source: transferId }
    })
    const openedWindow = window.open(route.href, '_blank')

    if (!openedWindow) {
      discardSecsSmlTransferText(transferId)
      ElMessage.error('打开 SECS SML 格式化页面失败，请检查浏览器弹窗设置')
      return
    }

    ElMessage.success('已发送至 SECS SML 格式化')
  } catch {
    ElMessage.error('发送失败，请稍后重试')
  } finally {
    closeBlockContextMenu()
  }
}

function handleDocumentClick() {
  closeBlockContextMenu()
}

function handleWindowResize() {
  closeBlockContextMenu()
}

function handleWindowKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    closeBlockContextMenu()
  }
}

async function focusNavigatorRow(rowId: string) {
  const row = result.value?.rows.find(item => item.id === rowId)
  if (!row || row.kind === 'equal') {
    return
  }

  if (diffFilter.value !== 'all' && diffFilter.value !== row.kind) {
    diffFilter.value = 'all'
    await nextTick()
  }

  diffNavigatorRef.value?.centerAndFlash(rowId)
}

function selectRowFromEditor(rowId: string) {
  selectedRowId.value = rowId
  triggerEditorFlash(rowId)
  void focusNavigatorRow(rowId)
}

function selectRow(rowId: string) {
  selectedRowId.value = rowId
  const row = result.value?.rows.find(item => item.id === rowId)
  if (!row) {
    return
  }

  scrollViewToLine(baselineViewRef.value, row.baselineDisplayStartLine)
  scrollViewToLine(targetViewRef.value, row.targetDisplayStartLine)
  triggerEditorFlash(rowId)
}

function openRowDetail(rowId: string) {
  selectRow(rowId)
  detailVisible.value = true
}

function runDiffWorker(request: SecsLogDiffWorkerRequest) {
  return new Promise<SecsLogDiffWorkerResponse>((resolve, reject) => {
    activeWorker?.terminate()
    const worker = new Worker(new URL('./secsLogDiff.worker.ts', import.meta.url), { type: 'module' })
    activeWorker = worker

    const cleanup = () => {
      if (activeWorker === worker) {
        activeWorker = null
      }
      worker.onmessage = null
      worker.onerror = null
      worker.terminate()
    }

    worker.onmessage = (event: MessageEvent<SecsLogDiffWorkerResponse>) => {
      cleanup()
      resolve(event.data)
    }

    worker.onerror = (event) => {
      cleanup()
      reject(new Error(event.message || 'SECS 日志差异分析失败'))
    }

    worker.postMessage(request)
  })
}

async function runAnalyze() {
  if (loading.value) {
    return
  }

  closeBlockContextMenu()

  if (!canAnalyze.value) {
    ElMessage.warning('请先输入或导入至少一份日志')
    return
  }

  loading.value = true
  await nextTick()

  try {
    const response = await runDiffWorker({
      type: 'analyze',
      baselineText: baselineInput.value,
      targetText: targetInput.value,
      options: {
        matchWindowSize: SECS_LOG_DIFF_LIMITS.matchWindowSize,
        includeEqualRows: includeEqualRows.value,
        profile: cloneProfileForWorker()
      }
    })

    if (response.type === 'error') {
      throw new Error(response.error)
    }

    result.value = response.result
    baselineDisplayText.value = response.result.baselineText
    targetDisplayText.value = response.result.targetText
    selectedRowId.value = response.result.rows.find(row => row.kind !== 'equal')?.id || response.result.rows[0]?.id || ''
    inputDialogVisible.value = false
    await nextTick()
    updateHighlights()
    if (selectedRowId.value) {
      const row = response.result.rows.find(item => item.id === selectedRowId.value)
      if (row) {
        scrollViewToLine(baselineViewRef.value, row.baselineDisplayStartLine)
        scrollViewToLine(targetViewRef.value, row.targetDisplayStartLine)
      }
    }
  } catch (error: unknown) {
    ElMessage.error(error instanceof Error ? error.message : 'SECS 日志差异分析失败')
  } finally {
    loading.value = false
  }
}

function clearInputs() {
  baselineInput.value = ''
  targetInput.value = ''
}

function cloneProfileForWorker() {
  return JSON.parse(JSON.stringify(toRaw(activeProfile.value))) as SecsLogDiffProfile
}

function downloadTextFile(content: string, fileName: string, type = 'application/json;charset=utf-8') {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function exportProfile() {
  downloadTextFile(JSON.stringify(activeProfile.value, null, 2), `${activeProfile.value.id || 'secs-log-diff-profile'}.json`)
}

function applyProfile(profile: SecsLogDiffProfile) {
  activeProfile.value = profile
  ElMessage.success(`已应用规则：${profile.name}`)
}

function applyPagePadding() {
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

function restorePagePadding() {
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

watch(selectedRowId, updateHighlights)

onMounted(() => {
  applyPagePadding()
  autoOpenDialogTimer = window.setTimeout(() => {
    inputDialogVisible.value = true
  }, 250)
  document.addEventListener('click', handleDocumentClick)
  window.addEventListener('resize', handleWindowResize)
  window.addEventListener('keydown', handleWindowKeydown)
})

onUnmounted(() => {
  activeWorker?.terminate()
  document.removeEventListener('click', handleDocumentClick)
  window.removeEventListener('resize', handleWindowResize)
  window.removeEventListener('keydown', handleWindowKeydown)
  if (highlightFrame !== undefined) {
    window.cancelAnimationFrame(highlightFrame)
  }
  if (flashTimer !== undefined) {
    window.clearTimeout(flashTimer)
  }
  if (autoOpenDialogTimer !== undefined) {
    window.clearTimeout(autoOpenDialogTimer)
  }
  restorePagePadding()
})
</script>

<style scoped>
.secs-log-diff-page {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  gap: 10px;
}

.topbar {
  display: flex;
  min-height: 50px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #ffffff;
  padding: 8px 12px;
}

.topbar__title {
  min-width: 0;
}

.topbar h1 {
  margin: 0;
  color: #1e293b;
  font-size: 15px;
  font-weight: 750;
  line-height: 22px;
}

.topbar p {
  overflow: hidden;
  margin: 0;
  color: #64748b;
  font-size: 12px;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.topbar__actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 8px;
}

.semantic-select {
  width: 112px;
}

.hidden {
  display: none;
}

.workbench {
  display: flex;
  min-height: 0;
  flex: 1;
  gap: 10px;
}

.diff-main {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  gap: 8px;
}

.warning-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.warning-strip span {
  border: 1px solid #fed7aa;
  border-radius: 5px;
  background: #fff7ed;
  padding: 4px 7px;
  color: #c2410c;
  font-size: 12px;
  line-height: 16px;
}

.diff-editors {
  display: grid;
  min-height: 0;
  flex: 1;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 8px;
}

.diff-pane {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #ffffff;
}

.diff-pane__header {
  display: flex;
  min-height: 42px;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
  padding: 7px 12px;
}

.diff-pane__header h2 {
  margin: 0;
  color: #334155;
  font-size: 14px;
  font-weight: 700;
  line-height: 20px;
}

.diff-pane__header p {
  margin: 0;
  color: #94a3b8;
  font-size: 12px;
  line-height: 16px;
}

.diff-pane__badge {
  border-radius: 4px;
  padding: 2px 7px;
  font-size: 11px;
  font-weight: 800;
  line-height: 16px;
}

.diff-pane__badge--baseline {
  background: #fee2e2;
  color: #b91c1c;
}

.diff-pane__badge--target {
  background: #dcfce7;
  color: #047857;
}

.editor-wrap {
  min-height: 0;
  flex: 1;
  overflow: hidden;
}

.statusbar {
  display: flex;
  min-height: 30px;
  align-items: center;
  gap: 14px;
  overflow: hidden;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #f8fafc;
  padding: 5px 10px;
  color: #64748b;
  font-size: 12px;
  white-space: nowrap;
}

.diff-block-context-menu {
  position: fixed;
  z-index: 3000;
  min-width: 148px;
  padding: 4px;
  border: 1px solid #dbe3ef;
  border-radius: 6px;
  background: #ffffff;
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.18);
}

.diff-block-context-menu__item {
  display: block;
  width: 100%;
  padding: 7px 10px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: #334155;
  font-size: 13px;
  line-height: 18px;
  text-align: left;
  cursor: pointer;
}

.diff-block-context-menu__item:hover,
.diff-block-context-menu__item:focus-visible {
  background: #eef6ff;
  color: #0369a1;
  outline: none;
}

.diff-block-context-menu__item:disabled {
  color: #94a3b8;
  cursor: not-allowed;
}

.diff-block-context-menu__item:disabled:hover,
.diff-block-context-menu__item:disabled:focus-visible {
  background: transparent;
  color: #94a3b8;
}

.empty-state {
  display: flex;
  min-height: 0;
  flex: 1;
  align-items: center;
  justify-content: center;
  border: 1px dashed #cbd5e1;
  border-radius: 8px;
  background: #f8fafc;
  text-align: center;
}

.empty-state h2 {
  margin: 0;
  color: #334155;
  font-size: 16px;
}

.empty-state p {
  margin: 8px 0 14px;
  color: #64748b;
  font-size: 13px;
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

@media (max-width: 1100px) {
  .workbench {
    flex-direction: column;
  }
}

@media (max-width: 760px) {
  .topbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .topbar__actions {
    width: 100%;
    justify-content: flex-end;
  }

  .diff-editors {
    grid-template-columns: 1fr;
  }
}
</style>

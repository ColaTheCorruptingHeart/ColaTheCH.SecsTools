<template>
  <div
    ref="pageRoot"
    class="relative h-full flex flex-col gap-4"
    v-loading="loading"
    element-loading-text="正在解析日志文件，请稍候..."
    @dragenter="handlePageDragEnter"
    @dragover="handlePageDragOver"
    @dragleave="handlePageDragLeave"
    @drop="handlePageDrop"
  >
    <!-- Main Content -->
    <div class="flex-1 flex flex-col lg:flex-row gap-2 min-h-0">
        <!-- Left: Rules -->
        <RulesPanel
        :ceid-match-mode="ceidMatchMode"
        :rules-list="rulesList"
        :sxfy-list="sxfyList"
        :predefine-colors="predefineColors"
        :has-log-content="Boolean(logContent)"
        @openCeidImport="importDialogVisible = true"
        @updateCeidMatchMode="updateCeidMatchMode"
        @openSxFyAdd="openSxFyDialog()"
        @openSxFyEdit="openSxFyDialog($event)"
        @removeRule="removeRule"
        @removeSxFyRule="removeSxFyRule"
        @triggerJsonImport="triggerJsonImport"
        @exportJsonConfig="exportJsonConfig"
        @rulesChanged="applyRulesAndParse"
        @highlightChanged="updateHighlights"
        />
        <input type="file" ref="jsonFileInput" class="hidden" accept=".json" @change="onJsonFileSelected" />

      <LogViewerPanel
        :log-content="logContent"
        :log-file-name="logFileName"
        :extensions="extensions"
        :marker-items="renderedMarkerItems"
        :bottom-offset="scrollInfo.bottomOffset"
        :has-view="Boolean(viewRef)"
        :performance-hint="logViewerPerformanceHint"
        :get-marker-color="getMarkerColor"
        :get-scroll-marker-top="getScrollMarkerTop"
        @update:logContent="logContent = $event"
        @ready="handleReady"
        @scroll="handleScroll"
      >
        <template #header-actions>
          <div class="flex items-center gap-2">
            <el-button
              :type="canSendRecordedLogsToDiff ? 'primary' : 'default'"
              :plain="!canSendRecordedLogsToDiff"
              :disabled="!canSendRecordedLogsToDiff"
              @click="sendRecordedLogsToGeneralDiffCompare"
              size="small"
            >
              通用差异对比
            </el-button>
            <el-button type="danger" plain @click="clearAllData" size="small">清空数据</el-button>
            <el-button type="primary" @click="triggerUpload" size="small">加载日志文件</el-button>
            <input type="file" ref="fileInput" class="hidden" accept=".log,.txt" multiple @change="onFileSelected" />
          </div>
        </template>
        <template #body-actions>
          <el-button
            v-if="canExportMarkedRange"
            class="log-range-export-button"
            type="primary"
            circle
            :loading="rangeExportHashing"
            :disabled="rangeExportHashing"
            title="导出标记区间"
            aria-label="导出标记区间"
            @click="exportMarkedRangeLogs"
          >
            <el-icon><Download /></el-icon>
          </el-button>
        </template>
      </LogViewerPanel>

      <!-- Right: Timeline -->
      <TimelinePanel
        ref="timelinePanelRef"
        :items="filteredTimelineData"
        :selected-item-keys="selectedTimelineItemKeys"
        :filter-sx-fy="filterSxFy"
        :filter-desc="filterDesc"
        :available-sx-fy-options="availableSxFyOptions"
        :available-desc-options="availableDescOptions"
        :export-keep-time-line="exportKeepTimeLine"
        :export-selected-only="exportSelectedOnly"
        :can-export="canExportTimelineItems"
        :get-marker-color="getMarkerColor"
        :get-item-key="getTimelineItemKey"
        @update:filterSxFy="filterSxFy = $event"
        @update:filterDesc="filterDesc = $event"
        @update:exportKeepTimeLine="exportKeepTimeLine = $event"
        @update:exportSelectedOnly="exportSelectedOnly = $event"
        @toggleItemChecked="toggleTimelineItemChecked"
        @timelineContextAction="handleTimelineContextAction"
        @timelineContextMenuOpened="closeMessageBlockContextMenu"
        @jump="jumpToLine"
        @flash-message-block="flashMessageBlockByLine"
        @exportLogs="exportMatchedLogs"
        @exportCommandSet="exportMatchedCommandSet"
      />
    </div>

    <div
      v-if="messageBlockContextMenu.visible"
      class="log-block-context-menu"
      :style="{ left: messageBlockContextMenu.left + 'px', top: messageBlockContextMenu.top + 'px' }"
      @click.stop
      @contextmenu.prevent.stop
    >
      <button
        class="log-block-context-menu__item"
        type="button"
        :disabled="!messageBlockContextMenu.selectedText"
        @click="copyContextMenuSelectedText"
      >
        复制选中内容
      </button>
      <button class="log-block-context-menu__item" type="button" @click="copyContextMenuMessageBlock">
        复制消息块
      </button>
      <button class="log-block-context-menu__item" type="button" @click="copyContextMenuFormattedMessageBlock">
        复制格式化消息块
      </button>
      <button class="log-block-context-menu__item" type="button" @click="sendContextMenuMessageBlockToSecsSmlFormatter">
        发送至SML格式化
      </button>
      <button class="log-block-context-menu__item" type="button" @click="markContextMenuBlockAsRangeStart">
        标记区间起始点
      </button>
      <button class="log-block-context-menu__item" type="button" @click="markContextMenuBlockAsRangeEnd">
        标记区间结束点
      </button>
      <button class="log-block-context-menu__item" type="button" :disabled="!hasMarkedRangePoint" @click="clearRangeMarkers(true)">
        清除区间标记
      </button>
      <button class="log-block-context-menu__item" type="button" @click="recordContextMenuMessageBlockToDiff('left')">
        记录至Diff-L
      </button>
      <button class="log-block-context-menu__item" type="button" @click="recordContextMenuMessageBlockToDiff('right')">
        记录至Diff-R
      </button>
    </div>

    <div v-if="isDraggingLogFiles" class="log-drop-overlay">
      <div class="log-drop-overlay__panel">
        松开以导入日志文件
      </div>
    </div>

    <CeidImportDialog
      v-model="importDialogVisible"
      :import-text="importText"
      @update:importText="importText = $event"
      @confirm="confirmImport"
    />

    <SxFyRuleDialog
      v-model="sxfyDialogVisible"
      :is-edit="isSxFyEdit"
      :form="sxfyForm"
      :predefine-colors="predefineColors"
      @save="saveSxFyRule"
    />

    <RangeExportDialog
      v-model="rangeExportDialogVisible"
      :machine-options="rangeExportMachineOptions"
      :start-line="rangeExportStartLine"
      :end-line="rangeExportEndLine"
      :log-date="logDate"
      :content-hash="rangeExportContentHash"
      @deleteMachineOption="removeRangeExportMachineOption"
      @confirm="confirmRangeExport"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, shallowRef, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Download } from '@element-plus/icons-vue'
import { EditorView, lineNumbers, Decoration } from '@codemirror/view'
import { Compartment, EditorState, Range, Text } from '@codemirror/state'
import JSZip from 'jszip'
import { LOG_TIMELINE_LIMITS } from './log-timeline/config'
import { buildCommandFileBaseName, buildExportedMatchedBlocks, buildUniqueFileName } from './log-timeline/exporters'
import { buildLogMessageBlocks, splitLogLines } from './log-timeline/parser'
import {
  buildRangeExportFileName,
  createRangeExportContentHash,
  deleteRangeExportMachineOption,
  extractDateFromFileName,
  loadRangeExportMachineSettings,
  saveRangeExportMachineSettings
} from './log-timeline/rangeExport'
import type { CeidMatchMode, LogMessageBlock, RuleItem, SxFyRuleItem, TimelineItem } from './log-timeline/types'
import { formatSecsSml } from './secsSml'
import { discardLogDiffTransferPayload, storeLogDiffTransferPayload } from './logDiffTransfer'
import { discardSecsSmlTransferText, storeSecsSmlTransferText } from './secsSmlTransfer'
import CeidImportDialog from './log-timeline/components/CeidImportDialog.vue'
import LogViewerPanel from './log-timeline/components/LogViewerPanel.vue'
import RangeExportDialog from './log-timeline/components/RangeExportDialog.vue'
import RulesPanel from './log-timeline/components/RulesPanel.vue'
import SxFyRuleDialog from './log-timeline/components/SxFyRuleDialog.vue'
import TimelinePanel from './log-timeline/components/TimelinePanel.vue'

const loading = ref(false)
const router = useRouter()
const pageRoot = ref<HTMLDivElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const jsonFileInput = ref<HTMLInputElement | null>(null)

type LogTimelineWorkerSuccessMessage = {
  type: 'success'
  timeline: TimelineItem[]
}

type LogTimelineWorkerErrorMessage = {
  type: 'error'
  error: string
}

type LogTimelineWorkerResponse = LogTimelineWorkerSuccessMessage | LogTimelineWorkerErrorMessage

type LogTimelineWorkerRequest = {
  logContent: string
  rulesList: RuleItem[]
  sxfyList: SxFyRuleItem[]
  ceidMatchMode: CeidMatchMode
}

let mainContentElement: HTMLElement | null = null
let previousMainPadding = ''
let previousMainPaddingVariable = ''
let parseRequestVersion = 0

const importDialogVisible = ref(false)
const importText = ref('')
const ceidMatchMode = ref<CeidMatchMode>('S6F11')

const rulesList = ref<RuleItem[]>([])
const sxfyList = ref<SxFyRuleItem[]>([
  { id: 'default-s2f41', s: 2, f: 41, keyPos: '[0][0]', color: '#f97316', enabled: true, desc: 'RCMD' },
  { id: 'default-s7f20', s: 7, f: 20, keyPos: '', color: '#8b5cf6', enabled: true, desc: 'RecipeList' }
])

const predefineColors = ref([
  '#3b82f6',
  '#ef4444',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#84cc16',
  '#f97316',
  '#6366f1'
])

const logContent = ref<string | null>(null)
const logFileName = ref('')
const logDate = ref('')
const defaultDocumentTitle = document.title
const timelineData = ref<TimelineItem[]>([])
const logMessageBlocks = ref<LogMessageBlock[]>([])
const editorTotalLines = ref(1)
const scrollInfo = ref({ bottomOffset: 0 })
const recordedDiffLeftText = ref('')
const recordedDiffRightText = ref('')
const isDraggingLogFiles = ref(false)
const exportKeepTimeLine = ref(true)
const exportSelectedOnly = ref(false)
const selectedTimelineItemKeys = ref<string[]>([])
const lastSelectedTimelineItemKey = ref<string | null>(null)
const messageBlockContextMenu = ref<{
  visible: boolean
  left: number
  top: number
  block: LogMessageBlock | null
  selectedText: string
}>({
  visible: false,
  left: 0,
  top: 0,
  block: null,
  selectedText: ''
})
const rangeStartBlock = ref<LogMessageBlock | null>(null)
const rangeEndBlock = ref<LogMessageBlock | null>(null)
const savedRangeExportMachineSettings = loadRangeExportMachineSettings()
const rangeExportDialogVisible = ref(false)
const rangeExportMachineOptions = ref(savedRangeExportMachineSettings.machineIds)
const rangeExportStartLine = ref(0)
const rangeExportEndLine = ref(0)
const rangeExportContent = ref('')
const rangeExportContentHash = ref('')
const rangeExportHashing = ref(false)
let rangeExportHashRequestVersion = 0

const resetRangeExportState = () => {
  rangeExportHashRequestVersion += 1
  rangeExportDialogVisible.value = false
  rangeExportStartLine.value = 0
  rangeExportEndLine.value = 0
  rangeExportContent.value = ''
  rangeExportContentHash.value = ''
  rangeExportHashing.value = false
}

const viewRef = shallowRef<EditorView>()
const timelinePanelRef = ref<InstanceType<typeof TimelinePanel> | null>(null)
let hoveredMessageBlockKey = ''
let logFileDragDepth = 0
let flashBlockTimer: number | undefined

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

const sortFilesByName = (files: File[]) => {
  return [...files].sort((left, right) => {
    if (left.name < right.name) return -1
    if (left.name > right.name) return 1
    return 0
  })
}

const removeFileExtension = (fileName: string) => {
  const extensionIndex = fileName.lastIndexOf('.')
  return extensionIndex > 0 ? fileName.slice(0, extensionIndex) : fileName
}

const mergeLogTexts = (texts: string[]) => {
  const mergedParts: string[] = []

  texts.forEach((text, index) => {
    if (index > 0 && mergedParts.length > 0) {
      const previous = mergedParts[mergedParts.length - 1] || ''
      if (!previous.endsWith('\n')) {
        mergedParts.push('\n')
      }
    }

    mergedParts.push(text)
  })

  return mergedParts.join('')
}

const readAndMergeLogFiles = async (files: File[]) => {
  const sortedFiles = sortFilesByName(files)
  const totalBytes = sortedFiles.reduce((sum, file) => sum + file.size, 0)

  if (totalBytes > LOG_TIMELINE_LIMITS.importMaxBytes) {
    throw new Error(`日志文件总大小超过限制（${(LOG_TIMELINE_LIMITS.importMaxBytes / 1024 / 1024).toFixed(0)} MB），请拆分后再导入`)
  }

  const texts: string[] = []
  let totalLines = 0

  for (const file of sortedFiles) {
    const text = await file.text()
    totalLines += countLines(text)

    if (totalLines > LOG_TIMELINE_LIMITS.importMaxLines) {
      throw new Error(`日志总行数超过限制（${LOG_TIMELINE_LIMITS.importMaxLines.toLocaleString()} 行），请拆分后再导入`)
    }

    texts.push(text)
  }

  return {
    mergedText: mergeLogTexts(texts),
    fileCount: sortedFiles.length,
    firstFileName: removeFileExtension(sortedFiles[0]?.name ?? ''),
    firstFileDate: extractDateFromFileName(sortedFiles[0]?.name ?? '') ?? ''
  }
}

const runLogTimelineWorker = (request: LogTimelineWorkerRequest) => {
  return new Promise<LogTimelineWorkerResponse>((resolve, reject) => {
    const worker = new Worker(new URL('./logTimeline.worker.ts', import.meta.url), { type: 'module' })

    const cleanup = () => {
      worker.onmessage = null
      worker.onerror = null
      worker.terminate()
    }

    worker.onmessage = (event: MessageEvent<LogTimelineWorkerResponse>) => {
      cleanup()
      resolve(event.data)
    }

    worker.onerror = (event) => {
      cleanup()
      reject(new Error(event.message || '日志解析失败'))
    }

    worker.postMessage(request)
  })
}

const createParseWorkerRequest = (currentLogContent: string): LogTimelineWorkerRequest => {
  return {
    logContent: currentLogContent,
    rulesList: rulesList.value.map(rule => ({ ...rule })),
    sxfyList: sxfyList.value.map(rule => ({ ...rule })),
    ceidMatchMode: ceidMatchMode.value
  }
}

const ceidColorMap = computed(() => {
  return new Map(rulesList.value.map(rule => [rule.ceid, rule.color]))
})

const sxfyColorMaps = computed(() => {
  const byRuleId = new Map<string, string>()
  const bySignature = new Map<string, string>()

  sxfyList.value.forEach(rule => {
    byRuleId.set(rule.id, rule.color)
    bySignature.set(`S${rule.s}F${rule.f}`, rule.color)
  })

  return { byRuleId, bySignature }
})

const getMarkerColor = (id: string, type: 'CEID' | 'SxFy' = 'CEID', ruleId?: string) => {
  if (type === 'SxFy') {
    if (ruleId) {
      const color = sxfyColorMaps.value.byRuleId.get(ruleId)
      if (color) return color
    }

    const signature = id.match(/S\d+F\d+/)?.[0]
    if (signature) {
      const color = sxfyColorMaps.value.bySignature.get(signature)
      if (color) return color
    }

    return '#10b981'
  }
  return ceidColorMap.value.get(id) ?? '#3b82f6'
}

const filterSxFy = ref<string>('')
const filterDesc = ref<string[]>([])

const availableSxFyOptions = computed(() => {
  const sxfySet = new Set<string>()
  timelineData.value.forEach(item => {
    if (item.sxFy) {
      sxfySet.add(item.sxFy)
    } else if (item.ceid) {
      const match = item.ceid.match(/S\d+F\d+/)
      if (match) sxfySet.add(match[0])
    }
  })
  return Array.from(sxfySet).sort()
})

const availableDescOptions = computed(() => {
  if (!filterSxFy.value) return []

  const descSet = new Set<string>()
  timelineData.value.forEach(item => {
    const isMatch = item.sxFy === filterSxFy.value

    if (isMatch && item.desc) {
      descSet.add(item.desc)
    }
  })

  return Array.from(descSet).sort()
})

const filteredTimelineData = computed(() => {
  return timelineData.value.filter(item => {
    if (filterSxFy.value) {
      if (item.sxFy !== filterSxFy.value) return false
      if (filterDesc.value.length > 0 && !filterDesc.value.includes(item.desc)) return false
    }
    return true
  })
})

const highlightDisabled = computed(() => {
  return filteredTimelineData.value.length > LOG_TIMELINE_LIMITS.highlightDecorationMaxCount
})

const sampleTimelineItems = (items: TimelineItem[], limit: number) => {
  if (items.length <= limit) {
    return items
  }

  const result: TimelineItem[] = []
  const lastIndex = items.length - 1

  for (let index = 0; index < limit; index += 1) {
    const sampleIndex = Math.min(lastIndex, Math.round((index * lastIndex) / Math.max(1, limit - 1)))
    const nextItem = items[sampleIndex]

    if (!nextItem) {
      continue
    }

    const previousItem = result[result.length - 1]

    if (!previousItem || getTimelineItemKey(previousItem) !== getTimelineItemKey(nextItem)) {
      result.push(nextItem)
    }
  }

  return result
}

const renderedMarkerItems = computed(() => {
  return sampleTimelineItems(filteredTimelineData.value, LOG_TIMELINE_LIMITS.scrollMarkerSampleMaxCount)
})

const canSendRecordedLogsToDiff = computed(() => {
  return Boolean(recordedDiffLeftText.value && recordedDiffRightText.value)
})

const hasMarkedRangePoint = computed(() => {
  return Boolean(rangeStartBlock.value || rangeEndBlock.value)
})

const canExportMarkedRange = computed(() => {
  return Boolean(logContent.value && rangeStartBlock.value && rangeEndBlock.value)
})

const markerSamplingEnabled = computed(() => {
  return renderedMarkerItems.value.length < filteredTimelineData.value.length
})

const logViewerPerformanceHint = computed(() => {
  if (highlightDisabled.value && markerSamplingEnabled.value) {
    return '命中较多，已关闭行高亮并采样滚动标记'
  }

  if (highlightDisabled.value) {
    return '命中较多，已关闭行高亮'
  }

  if (markerSamplingEnabled.value) {
    return '命中较多，已采样滚动标记'
  }

  return ''
})

const getTimelineItemKey = (item: TimelineItem) => {
  return [
    item.type || 'CEID',
    item.line,
    item.time,
    item.sxFy,
    item.ceid,
    item.ruleId || '',
    item.desc
  ].join('|')
}

const updateCeidMatchMode = (mode: CeidMatchMode) => {
  if (ceidMatchMode.value === mode) {
    return
  }

  ceidMatchMode.value = mode
  if (logContent.value) {
    applyRulesAndParse()
  }
}

const selectedTimelineItemKeySet = computed(() => {
  return new Set(selectedTimelineItemKeys.value)
})

const checkedFilteredTimelineData = computed(() => {
  return filteredTimelineData.value.filter(item => {
    return selectedTimelineItemKeySet.value.has(getTimelineItemKey(item))
  })
})

const exportTimelineItems = computed(() => {
  return exportSelectedOnly.value ? checkedFilteredTimelineData.value : filteredTimelineData.value
})

const canExportTimelineItems = computed(() => {
  return Boolean(logContent.value && exportTimelineItems.value.length)
})

const toggleTimelineItemChecked = ({ key, checked, shiftKey }: { key: string, checked: boolean, shiftKey: boolean }) => {
  const nextKeys = new Set(selectedTimelineItemKeys.value)

  if (shiftKey && lastSelectedTimelineItemKey.value && lastSelectedTimelineItemKey.value !== key) {
    const orderedKeys = filteredTimelineData.value.map(getTimelineItemKey)
    const anchorIndex = orderedKeys.indexOf(lastSelectedTimelineItemKey.value)
    const targetIndex = orderedKeys.indexOf(key)

    if (anchorIndex >= 0 && targetIndex >= 0) {
      const startIndex = Math.min(anchorIndex, targetIndex)
      const endIndex = Math.max(anchorIndex, targetIndex)

      orderedKeys.slice(startIndex, endIndex + 1).forEach(itemKey => {
        if (checked) {
          nextKeys.add(itemKey)
        } else {
          nextKeys.delete(itemKey)
        }
      })

      selectedTimelineItemKeys.value = Array.from(nextKeys)
      lastSelectedTimelineItemKey.value = key
      return
    }
  }

  if (checked) {
    nextKeys.add(key)
  } else {
    nextKeys.delete(key)
  }

  selectedTimelineItemKeys.value = Array.from(nextKeys)
  lastSelectedTimelineItemKey.value = key
}

const handleTimelineContextAction = ({ action, key }: { action: 'selectAll' | 'clearAll' | 'selectSameSxFy' | 'selectSameCeid', key?: string }) => {
  const currentItems = filteredTimelineData.value
  const nextKeys = new Set(selectedTimelineItemKeys.value)

  if (action === 'selectAll') {
    currentItems.forEach(item => {
      nextKeys.add(getTimelineItemKey(item))
    })
    const lastItem = currentItems[currentItems.length - 1]
    selectedTimelineItemKeys.value = Array.from(nextKeys)
    lastSelectedTimelineItemKey.value = key ?? (lastItem ? getTimelineItemKey(lastItem) : null)
    return
  }

  if (action === 'clearAll') {
    currentItems.forEach(item => {
      nextKeys.delete(getTimelineItemKey(item))
    })
    selectedTimelineItemKeys.value = Array.from(nextKeys)
    lastSelectedTimelineItemKey.value = null
    return
  }

  if (!key) {
    return
  }

  const contextItem = currentItems.find(item => getTimelineItemKey(item) === key)
  if (!contextItem) {
    return
  }

  if (action === 'selectSameSxFy') {
    currentItems.forEach(item => {
      if (item.sxFy === contextItem.sxFy) {
        nextKeys.add(getTimelineItemKey(item))
      }
    })
  } else if (action === 'selectSameCeid') {
    currentItems.forEach(item => {
      if (item.ceid === contextItem.ceid) {
        nextKeys.add(getTimelineItemKey(item))
      }
    })
  }

  selectedTimelineItemKeys.value = Array.from(nextKeys)
  lastSelectedTimelineItemKey.value = key
}

const getMessageBlockKey = (block: LogMessageBlock | null) => {
  if (!block) {
    return ''
  }

  return `${block.startLine}:${block.contentStartLine}:${block.endLine}`
}

const findHoveredMessageBlock = (lineNumber: number) => {
  let left = 0
  let right = logMessageBlocks.value.length - 1

  while (left <= right) {
    const middle = Math.floor((left + right) / 2)
    const block = logMessageBlocks.value[middle]

    if (!block) {
      break
    }

    if (lineNumber < block.startLine) {
      right = middle - 1
    } else if (lineNumber > block.endLine) {
      left = middle + 1
    } else {
      return block
    }
  }

  return null
}

const getLineNumberFromMouseEvent = (event: MouseEvent, view: EditorView) => {
  const position = view.posAtCoords({ x: event.clientX, y: event.clientY })
  if (position == null) {
    return -1
  }

  return view.state.doc.lineAt(position).number
}

const getHoverBlockExtension = (block: LogMessageBlock | null, doc: Text) => {
  if (!block) {
    return Decoration.none
  }

  const builder: Array<Range<Decoration>> = []
  const startLine = Math.max(1, block.startLine)
  const endLine = Math.min(doc.lines, block.endLine)
  const blockHighlight = Decoration.line({ attributes: { class: 'cm-log-hover-block' } })

  for (let lineNumber = startLine; lineNumber <= endLine; lineNumber += 1) {
    const lineData = doc.line(lineNumber)
    builder.push(blockHighlight.range(lineData.from, lineData.from))
  }

  return Decoration.set(builder, true)
}

const addMarkedBlockLines = (lineClassMap: Map<number, string[]>, block: LogMessageBlock | null, className: string, doc: Text) => {
  if (!block) {
    return
  }

  const startLine = Math.max(1, block.startLine)
  const endLine = Math.min(doc.lines, block.endLine)
  for (let lineNumber = startLine; lineNumber <= endLine; lineNumber += 1) {
    const classes = lineClassMap.get(lineNumber) || []
    classes.push(className)
    lineClassMap.set(lineNumber, classes)
  }
}

const getRangeMarkExtension = (doc: Text) => {
  const lineClassMap = new Map<number, string[]>()
  addMarkedBlockLines(lineClassMap, rangeStartBlock.value, 'cm-log-range-start', doc)
  addMarkedBlockLines(lineClassMap, rangeEndBlock.value, 'cm-log-range-end', doc)

  const builder: Array<Range<Decoration>> = []
  lineClassMap.forEach((classes, lineNumber) => {
    const lineData = doc.line(lineNumber)
    const markDecoration = Decoration.line({ attributes: { class: classes.join(' ') } })
    builder.push(markDecoration.range(lineData.from, lineData.from))
  })

  builder.sort((left, right) => left.from - right.from)
  return Decoration.set(builder, true)
}

const updateRangeMarkHighlights = () => {
  if (!viewRef.value) {
    return
  }

  viewRef.value.dispatch({
    effects: rangeMarkCompartment.reconfigure(EditorView.decorations.of(getRangeMarkExtension(viewRef.value.state.doc)))
  })
}

const getFlashBlockExtension = (block: LogMessageBlock | null, doc: Text) => {
  if (!block) {
    return Decoration.none
  }

  const builder: Array<Range<Decoration>> = []
  const startLine = Math.max(1, block.startLine)
  const endLine = Math.min(doc.lines, block.endLine)
  const blockFlash = Decoration.line({ attributes: { class: 'cm-log-flash-block' } })

  for (let lineNumber = startLine; lineNumber <= endLine; lineNumber += 1) {
    const lineData = doc.line(lineNumber)
    builder.push(blockFlash.range(lineData.from, lineData.from))
  }

  return Decoration.set(builder, true)
}

const clearMessageBlockFlash = () => {
  if (flashBlockTimer !== undefined) {
    window.clearTimeout(flashBlockTimer)
    flashBlockTimer = undefined
  }

  if (!viewRef.value) {
    return
  }

  viewRef.value.dispatch({
    effects: flashBlockCompartment.reconfigure(EditorView.decorations.of(Decoration.none))
  })
}

const triggerMessageBlockFlash = (block: LogMessageBlock | null) => {
  clearMessageBlockFlash()
  if (!block || !viewRef.value) {
    return
  }

  window.requestAnimationFrame(() => {
    if (!viewRef.value) {
      return
    }

    viewRef.value.dispatch({
      effects: flashBlockCompartment.reconfigure(EditorView.decorations.of(getFlashBlockExtension(block, viewRef.value.state.doc)))
    })

    flashBlockTimer = window.setTimeout(() => {
      clearMessageBlockFlash()
    }, 1800)
  })
}

const updateHoveredMessageBlock = (block: LogMessageBlock | null) => {
  const nextKey = getMessageBlockKey(block)
  if (nextKey === hoveredMessageBlockKey) {
    return
  }

  hoveredMessageBlockKey = nextKey

  if (!viewRef.value) {
    return
  }

  viewRef.value.dispatch({
    effects: hoverBlockCompartment.reconfigure(EditorView.decorations.of(getHoverBlockExtension(block, viewRef.value.state.doc)))
  })
}

const clearHoveredMessageBlock = () => {
  updateHoveredMessageBlock(null)
}

const closeMessageBlockContextMenu = () => {
  if (!messageBlockContextMenu.value.visible) {
    return
  }

  messageBlockContextMenu.value = {
    visible: false,
    left: 0,
    top: 0,
    block: null,
    selectedText: ''
  }
}

const getContextMenuPosition = (event: MouseEvent) => {
  const menuWidth = 148
  const menuHeight = 316
  const margin = 8

  return {
    left: Math.max(margin, Math.min(event.clientX, window.innerWidth - menuWidth - margin)),
    top: Math.max(margin, Math.min(event.clientY, window.innerHeight - menuHeight - margin))
  }
}

const getMessageBlockText = (block: LogMessageBlock) => {
  if (!logContent.value) {
    return ''
  }

  return splitLogLines(logContent.value)
    .slice(block.startLine - 1, block.endLine)
    .join('\n')
}

const getSelectedText = (view: EditorView) => {
  const ranges = view.state.selection.ranges.filter(range => !range.empty)
  if (!ranges.length) {
    return ''
  }

  return ranges
    .map(range => view.state.doc.sliceString(range.from, range.to))
    .join('\n')
}

const copyTextToClipboard = async (text: string) => {
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

const copyContextMenuSelectedText = async () => {
  const text = messageBlockContextMenu.value.selectedText
  if (!text) {
    closeMessageBlockContextMenu()
    ElMessage.warning('当前没有选中内容，无法复制')
    return
  }

  try {
    await copyTextToClipboard(text)
    ElMessage.success('选中内容已复制')
  } catch {
    ElMessage.error('复制失败，请手动复制')
  } finally {
    closeMessageBlockContextMenu()
  }
}

const copyContextMenuMessageBlock = async () => {
  const block = messageBlockContextMenu.value.block
  if (!block) {
    closeMessageBlockContextMenu()
    return
  }

  const text = getMessageBlockText(block)
  if (!text) {
    closeMessageBlockContextMenu()
    ElMessage.warning('当前消息块为空，无法复制')
    return
  }

  try {
    await copyTextToClipboard(text)
    ElMessage.success('消息块已复制')
  } catch {
    ElMessage.error('复制失败，请手动复制')
  } finally {
    closeMessageBlockContextMenu()
  }
}

const copyContextMenuFormattedMessageBlock = async () => {
  const block = messageBlockContextMenu.value.block
  if (!block) {
    closeMessageBlockContextMenu()
    return
  }

  const text = getMessageBlockText(block)
  if (!text) {
    closeMessageBlockContextMenu()
    ElMessage.warning('当前消息块为空，无法复制')
    return
  }

  const formattedText = formatSecsSml(text).text
  if (!formattedText) {
    closeMessageBlockContextMenu()
    ElMessage.warning('当前消息块无法格式化')
    return
  }

  try {
    await copyTextToClipboard(formattedText)
    ElMessage.success('格式化消息块已复制')
  } catch {
    ElMessage.error('复制失败，请手动复制')
  } finally {
    closeMessageBlockContextMenu()
  }
}

const sendContextMenuMessageBlockToSecsSmlFormatter = () => {
  const block = messageBlockContextMenu.value.block
  if (!block) {
    closeMessageBlockContextMenu()
    return
  }

  const text = getMessageBlockText(block)
  if (!text) {
    closeMessageBlockContextMenu()
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
    closeMessageBlockContextMenu()
  }
}

const markContextMenuBlockAsRangeStart = () => {
  const block = messageBlockContextMenu.value.block
  if (!block) {
    closeMessageBlockContextMenu()
    return
  }

  rangeStartBlock.value = block
  updateRangeMarkHighlights()
  closeMessageBlockContextMenu()
  ElMessage.success('已标记区间起始点')
}

const markContextMenuBlockAsRangeEnd = () => {
  const block = messageBlockContextMenu.value.block
  if (!block) {
    closeMessageBlockContextMenu()
    return
  }

  rangeEndBlock.value = block
  updateRangeMarkHighlights()
  closeMessageBlockContextMenu()
  ElMessage.success('已标记区间结束点')
}

const clearRangeMarkers = (showMessage = false) => {
  rangeStartBlock.value = null
  rangeEndBlock.value = null
  updateRangeMarkHighlights()
  closeMessageBlockContextMenu()

  if (showMessage) {
    ElMessage.success('已清除区间标记')
  }
}

const recordContextMenuMessageBlockToDiff = (side: 'left' | 'right') => {
  const block = messageBlockContextMenu.value.block
  if (!block) {
    closeMessageBlockContextMenu()
    return
  }

  const text = getMessageBlockText(block)
  if (!text) {
    closeMessageBlockContextMenu()
    ElMessage.warning('当前消息块为空，无法记录')
    return
  }

  if (side === 'left') {
    recordedDiffLeftText.value = text
    ElMessage.success('已记录至 Diff-L')
  } else {
    recordedDiffRightText.value = text
    ElMessage.success('已记录至 Diff-R')
  }

  closeMessageBlockContextMenu()
}

const clearRecordedDiffLogs = () => {
  recordedDiffLeftText.value = ''
  recordedDiffRightText.value = ''
}

const sendRecordedLogsToGeneralDiffCompare = () => {
  if (!canSendRecordedLogsToDiff.value) {
    ElMessage.warning('请先分别记录 Diff-L 与 Diff-R')
    return
  }

  try {
    const transferId = storeLogDiffTransferPayload({
      left: recordedDiffLeftText.value,
      right: recordedDiffRightText.value
    })
    const route = router.resolve({
      path: '/tools/general-diff-compare',
      query: { source: transferId }
    })
    const openedWindow = window.open(route.href, '_blank')

    if (!openedWindow) {
      discardLogDiffTransferPayload(transferId)
      ElMessage.error('打开通用差异对比页面失败，请检查浏览器弹窗设置')
      return
    }

    ElMessage.success('已发送至通用差异对比')
  } catch {
    ElMessage.error('发送失败，请稍后重试')
  }
}

const rebuildLogMessageBlocks = (content: string | null) => {
  logMessageBlocks.value = content ? buildLogMessageBlocks(splitLogLines(content)) : []
  clearRangeMarkers()
  clearMessageBlockFlash()
  clearHoveredMessageBlock()
}

const handleLogMouseMove = (event: MouseEvent, view: EditorView) => {
  const lineNumber = getLineNumberFromMouseEvent(event, view)
  if (lineNumber < 1 || lineNumber > view.state.doc.lines) {
    clearHoveredMessageBlock()
    return false
  }

  const line = view.state.doc.line(lineNumber)
  if (!line.text.trim()) {
    clearHoveredMessageBlock()
    return false
  }

  updateHoveredMessageBlock(findHoveredMessageBlock(lineNumber))
  return false
}

const findTimelineItemByBlock = (block: LogMessageBlock) => {
  return filteredTimelineData.value.find(item => item.line >= block.startLine && item.line <= block.endLine) || null
}

const handleLogDoubleClick = (event: MouseEvent, view: EditorView) => {
  const lineNumber = getLineNumberFromMouseEvent(event, view)
  const block = lineNumber > 0 ? findHoveredMessageBlock(lineNumber) : null
  if (!block) {
    return false
  }

  const item = findTimelineItemByBlock(block)
  if (!item) {
    return false
  }

  timelinePanelRef.value?.centerAndFlashItem(getTimelineItemKey(item))
  return true
}

const handleLogContextMenu = (event: MouseEvent, view: EditorView) => {
  const lineNumber = getLineNumberFromMouseEvent(event, view)
  const block = lineNumber > 0 ? findHoveredMessageBlock(lineNumber) : null

  if (!block) {
    closeMessageBlockContextMenu()
    return false
  }

  event.preventDefault()
  event.stopPropagation()
  updateHoveredMessageBlock(block)

  const position = getContextMenuPosition(event)
  messageBlockContextMenu.value = {
    visible: true,
    left: position.left,
    top: position.top,
    block,
    selectedText: getSelectedText(view)
  }

  return true
}

const handleDocumentClick = () => {
  closeMessageBlockContextMenu()
}

const handleWindowResize = () => {
  closeMessageBlockContextMenu()
}

const handleWindowKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    closeMessageBlockContextMenu()
  }
}

watch(logContent, rebuildLogMessageBlocks)

watch(logFileName, (fileName) => {
  document.title = fileName ? `${fileName} - ${defaultDocumentTitle}` : defaultDocumentTitle
})

watch([filterSxFy, filterDesc], ([newSxFy], [oldSxFy]) => {
  if (newSxFy !== oldSxFy) {
    if (newSxFy) {
      const newArr = filterDesc.value.filter(desc => availableDescOptions.value.includes(desc))
      if (newArr.length !== filterDesc.value.length) {
        filterDesc.value = newArr
      }
    } else if (filterDesc.value.length > 0) {
      filterDesc.value = []
    }
  }
  updateHighlights()
}, { deep: true })

const getRandomDistinctColor = () => {
  const h = Math.floor(Math.random() * 360)
  const s = Math.floor(Math.random() * 40 + 60)
  const l = Math.floor(Math.random() * 20 + 40)

  const c = (1 - Math.abs(2 * l / 100 - 1)) * (s / 100)
  const x = c * (1 - Math.abs((h / 60) % 2 - 1))
  const m = l / 100 - c / 2
  let r = 0, g = 0, b = 0

  if (0 <= h && h < 60) { r = c; g = x; b = 0 }
  else if (60 <= h && h < 120) { r = x; g = c; b = 0 }
  else if (120 <= h && h < 180) { r = 0; g = c; b = x }
  else if (180 <= h && h < 240) { r = 0; g = x; b = c }
  else if (240 <= h && h < 300) { r = x; g = 0; b = c }
  else if (300 <= h && h < 360) { r = c; g = 0; b = x }

  const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

const parseImportText = (text: string) => {
  const newRules: RuleItem[] = []
  text.split('\n').forEach(line => {
    const parts = line.split('=')
    if (parts.length === 2 && parts[0] && parts[1] && parts[0].trim() !== '') {
      const ceid = parts[0].trim()
      const desc = parts[1].trim()
      const existing = newRules.find(r => r.ceid === ceid)
      if (!existing) {
        newRules.push({
          ceid,
          desc,
          color: getRandomDistinctColor(),
          enabled: true
        })
      } else if (existing.desc !== desc) {
        ElMessage.warning(`发现相同 CEID(${ceid}) 但描述不同的条目，已跳过新条目: ${desc}`)
      }
    }
  })
  return newRules
}

const confirmImport = () => {
  const newRules = parseImportText(importText.value)
  let added = 0
  newRules.forEach(nr => {
    const existing = rulesList.value.find(r => r.ceid === nr.ceid)
    if (!existing) {
      rulesList.value.push(nr)
      added++
    } else if (existing.desc !== nr.desc) {
      ElMessage.warning(`无法导入 CEID(${nr.ceid})：规则已存在且描述冲突 -> 原:${existing.desc} / 新:${nr.desc}`)
    }
  })
  ElMessage.success(`成功导入 ${added} 条新规则`)
  importDialogVisible.value = false
  importText.value = ''

  if (logContent.value) {
    applyRulesAndParse()
  }
}

const removeRule = (index: number) => {
  rulesList.value.splice(index, 1)
  if (logContent.value) {
      applyRulesAndParse()
  } else {
      updateHighlights()
  }
}

const sxfyDialogVisible = ref(false)
const isSxFyEdit = ref(false)
const sxfyForm = ref<SxFyRuleItem>({ id: '', s: 1, f: 1, color: '#10b981', enabled: true, keyPos: '', desc: '' })

const openSxFyDialog = (rule?: SxFyRuleItem) => {
    if (rule) {
        isSxFyEdit.value = true
        sxfyForm.value = { ...rule }
    } else {
        isSxFyEdit.value = false
        sxfyForm.value = {
            id: Date.now().toString() + Math.random().toString().slice(2,5),
            s: 1,
            f: 1,
            color: predefineColors.value[sxfyList.value.length % predefineColors.value.length] || '#f97316',
            enabled: true,
            keyPos: '',
            desc: ''
        }
    }
    sxfyDialogVisible.value = true
}

const saveSxFyRule = (formValue: SxFyRuleItem) => {
  const nextForm = { ...formValue }
  if (nextForm.keyPos) nextForm.keyPos = nextForm.keyPos.trim()

    // Conflict Check
  const exists = sxfyList.value.find(r => r.s === nextForm.s && r.f === nextForm.f && r.keyPos === nextForm.keyPos && r.id !== nextForm.id)
    if (exists) {
        ElMessage.warning('该 SxFy 规则及对应关键值位置已存在，请勿重复添加')
        return
    }

    if (isSxFyEdit.value) {
    const idx = sxfyList.value.findIndex(r => r.id === nextForm.id)
        if (idx !== -1) {
      sxfyList.value.splice(idx, 1, nextForm)
        }
    } else {
    sxfyList.value.push(nextForm)
    }
    sxfyDialogVisible.value = false
    if (logContent.value) {
        applyRulesAndParse()
    }
}

const removeSxFyRule = (index: number) => {
  sxfyList.value.splice(index, 1)
  if (logContent.value) {
      applyRulesAndParse()
  } else {
      updateHighlights()
  }
}

const updateHighlights = () => {
  if (!viewRef.value) return

  if (filteredTimelineData.value.length === 0 || highlightDisabled.value) {
    viewRef.value.dispatch({
      effects: highlightCompartment.reconfigure(EditorView.decorations.of(Decoration.none))
    })
    return
  }

  const doc = viewRef.value.state.doc
  viewRef.value.dispatch({
    effects: highlightCompartment.reconfigure(EditorView.decorations.of(getHighlightExtension(filteredTimelineData.value, doc)))
  })
}

const downloadBlobFile = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

const downloadTextFile = (content: string, fileName: string) => {
  downloadBlobFile(new Blob([content], { type: 'text/plain;charset=utf-8' }), fileName)
}

const exportMarkedRangeLogs = async () => {
  if (rangeExportHashing.value) {
    return
  }

  const currentLogContent = logContent.value
  const currentStartBlock = rangeStartBlock.value
  const currentEndBlock = rangeEndBlock.value

  if (!currentLogContent || !currentStartBlock || !currentEndBlock) {
    ElMessage.warning('请先标记区间起始点和区间结束点')
    return
  }

  if (currentStartBlock.startLine > currentEndBlock.endLine) {
    ElMessage.warning('区间起始点不能晚于区间结束点')
    return
  }

  if (!logDate.value) {
    ElMessage.warning('无法从首个日志文件名中提取日志日期，请检查文件名')
    return
  }

  const lines = splitLogLines(currentLogContent)
  const exportLines = lines.slice(currentStartBlock.startLine - 1, currentEndBlock.endLine)
  if (!exportLines.length) {
    ElMessage.warning('标记区间没有可导出的日志')
    return
  }

  const exportContent = `${exportLines.join('\n')}\n`
  const hashRequestVersion = ++rangeExportHashRequestVersion
  rangeExportHashing.value = true

  try {
    const contentHash = await createRangeExportContentHash(exportContent)
    if (hashRequestVersion !== rangeExportHashRequestVersion) {
      return
    }

    rangeExportStartLine.value = currentStartBlock.startLine
    rangeExportEndLine.value = currentEndBlock.endLine
    rangeExportContent.value = exportContent
    rangeExportContentHash.value = contentHash
    rangeExportDialogVisible.value = true
  } catch (error: unknown) {
    if (hashRequestVersion === rangeExportHashRequestVersion) {
      ElMessage.error(`生成内容哈希失败: ${getErrorMessage(error)}`)
    }
  } finally {
    if (hashRequestVersion === rangeExportHashRequestVersion) {
      rangeExportHashing.value = false
    }
  }
}

const confirmRangeExport = ({ machineId, batchId }: { machineId: string, batchId: string }) => {
  if (!rangeExportContent.value || !logDate.value || !rangeExportContentHash.value) {
    ElMessage.warning('导出信息已失效，请重新选择导出区间')
    rangeExportDialogVisible.value = false
    return
  }

  const fileName = buildRangeExportFileName({
    machineId,
    batchId,
    startLine: rangeExportStartLine.value,
    endLine: rangeExportEndLine.value,
    logDate: logDate.value,
    contentHash: rangeExportContentHash.value
  })
  const savedSettings = saveRangeExportMachineSettings(machineId, rangeExportMachineOptions.value)
  rangeExportMachineOptions.value = savedSettings.machineIds

  downloadTextFile(rangeExportContent.value, fileName)
  rangeExportDialogVisible.value = false
  ElMessage.success(`已导出第 ${rangeExportStartLine.value.toLocaleString()} 行至第 ${rangeExportEndLine.value.toLocaleString()} 行`)
}

const removeRangeExportMachineOption = (machineId: string) => {
  const savedSettings = deleteRangeExportMachineOption(machineId, rangeExportMachineOptions.value)
  rangeExportMachineOptions.value = savedSettings.machineIds
}

const getExportCandidateTimelineItems = () => {
  if (!logContent.value) {
    ElMessage.warning('请先加载日志文件')
    return null
  }

  if (!filteredTimelineData.value.length) {
    ElMessage.warning('当前没有可导出的命中记录')
    return null
  }

  if (exportSelectedOnly.value && !checkedFilteredTimelineData.value.length) {
    ElMessage.warning('当前没有已勾选的命中记录')
    return null
  }

  return exportTimelineItems.value
}

const exportMatchedLogs = () => {
  const exportItems = getExportCandidateTimelineItems()
  if (!logContent.value || !exportItems) {
    return
  }

  const exportedBlocks = buildExportedMatchedBlocks(logContent.value, exportItems, exportKeepTimeLine.value)

  if (!exportedBlocks.length) {
    ElMessage.warning('未能根据命中记录定位到完整报文')
    return
  }

  const now = new Date()
  const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`
  downloadTextFile(`${exportedBlocks.map(block => block.text).join('\n\n')}\n`, `timeline-hits-${timestamp}.log`)
  ElMessage.success(`已导出 ${exportedBlocks.length} 条去重后的完整报文`)
}

const exportMatchedCommandSet = async () => {
  const exportItems = getExportCandidateTimelineItems()
  if (!logContent.value || !exportItems) {
    return
  }

  const exportedBlocks = buildExportedMatchedBlocks(logContent.value, exportItems, exportKeepTimeLine.value)
  if (!exportedBlocks.length) {
    ElMessage.warning('未能根据命中记录生成报文集')
    return
  }

  const zip = new JSZip()
  const nameCounter = new Map<string, number>()

  exportedBlocks.forEach(block => {
    const baseName = buildCommandFileBaseName(block)
    const fileName = buildUniqueFileName(baseName, nameCounter)
    zip.file(fileName, `${block.text}\n`)
  })

  try {
    const zipBlob = await zip.generateAsync({ type: 'blob' })
    const now = new Date()
    const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`
    downloadBlobFile(zipBlob, `timeline-command-set-${timestamp}.zip`)
    ElMessage.success(`已导出 ${exportedBlocks.length} 条报文集报文压缩包`)
  } catch (error: unknown) {
    ElMessage.error(`导出报文集失败: ${getErrorMessage(error)}`)
  }
}

// Scrollbar calculations
const getScrollMarkerTop = (line: number) => {
  const total = editorTotalLines.value || 1
  if (total <= 1) return '0%'
  // Map 1-indexed line to 0-based ratio
  const ratio = Math.max(0, line - 1) / total
  // Prevent bottom marker from bleeding out by shifting it upwards proportionally
  return `calc(${ratio * 100}% - ${ratio * 3}px)`
}

const getErrorMessage = (error: unknown) => {
  return error instanceof Error ? error.message : '未知错误'
}

// Handle Editor scroll geometries natively
const syncScrollGeometry = (view: EditorView) => {
  const scrollDOM = view.scrollDOM
  const offset = scrollDOM.offsetHeight - scrollDOM.clientHeight
  if (scrollInfo.value.bottomOffset !== offset) {
     scrollInfo.value.bottomOffset = offset
  }
}

// CodeMirror Extensions Setup
const highlightCompartment = new Compartment()
const hoverBlockCompartment = new Compartment()
const rangeMarkCompartment = new Compartment()
const flashBlockCompartment = new Compartment()
const baseTheme = EditorView.theme({
  ".cm-scroller": {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace !important',
    fontSize: '12px'
  },
  ".cm-log-hover-block": {
    backgroundColor: 'rgba(14, 165, 233, 0.12) !important',
    boxShadow: 'inset 3px 0 0 #0ea5e9'
  },
  ".cm-log-flash-block": {
    animation: 'log-message-block-flash 0.55s ease-in-out 3'
  },
  "@keyframes log-message-block-flash": {
    "0%, 100%": {
      backgroundColor: 'rgba(14, 165, 233, 0.10)'
    },
    "50%": {
      backgroundColor: 'rgba(14, 165, 233, 0.34)',
      boxShadow: 'inset 3px 0 0 #0284c7'
    }
  },
  ".cm-log-range-start": {
    boxShadow: 'inset 4px 0 0 #10b981'
  },
  ".cm-log-range-end": {
    boxShadow: 'inset 4px 0 0 #ef4444'
  },
  ".cm-log-range-start.cm-log-range-end": {
    boxShadow: 'inset 4px 0 0 #10b981, inset 8px 0 0 #ef4444'
  }
})

// Dynamic line decorations builder
const getHighlightExtension = (timeline: typeof timelineData.value, doc: Text) => {
  const builder: Array<Range<Decoration>> = []
  timeline.forEach(item => {
    if (item.line <= doc.lines) {
      const lineData = doc.line(item.line)
      const color = getMarkerColor(item.ceid, item.type, item.ruleId)

      const LineHighlight = Decoration.line({
        attributes: { style: `background-color: ${color}25 !important` } // 25 is hex for slight transparency
      })
      builder.push(LineHighlight.range(lineData.from, lineData.from))
    }
  })

  builder.sort((a, b) => a.from - b.from)
  const uniqueBuilder = builder.filter((item, pos, ary) => {
    const previous = ary[pos - 1]
    return !previous || item.from !== previous.from
  })
  return Decoration.set(uniqueBuilder, true)
}

const extensions = [
  baseTheme,
  lineNumbers(),
  EditorState.readOnly.of(true),
  highlightCompartment.of(EditorView.decorations.of(Decoration.none)),
  hoverBlockCompartment.of(EditorView.decorations.of(Decoration.none)),
  rangeMarkCompartment.of(EditorView.decorations.of(Decoration.none)),
  flashBlockCompartment.of(EditorView.decorations.of(Decoration.none)),
  EditorView.updateListener.of((update) => {
    if (update.geometryChanged || update.docChanged) {
       editorTotalLines.value = update.view.state.doc.lines
       syncScrollGeometry(update.view)
    }
  }),
  EditorView.domEventHandlers({
    mousemove(event, view) {
      return handleLogMouseMove(event, view)
    },
    dblclick(event, view) {
      return handleLogDoubleClick(event, view)
    },
    contextmenu(event, view) {
      return handleLogContextMenu(event, view)
    },
    mouseleave() {
      if (!messageBlockContextMenu.value.visible) {
        clearHoveredMessageBlock()
      }
      return false
    }
  })
]

const handleReady = (payload: { view: EditorView }) => {
  viewRef.value = payload.view
  if (payload.view && payload.view.state) {
    editorTotalLines.value = payload.view.state.doc.lines
    syncScrollGeometry(payload.view)
    updateHighlights()
    updateRangeMarkHighlights()
  }
}

const handleScroll = () => {
  closeMessageBlockContextMenu()
  clearHoveredMessageBlock()
}

const triggerUpload = () => {
  fileInput.value?.click()
}

const hasDraggedFiles = (event: DragEvent) => {
  return Array.from(event.dataTransfer?.types || []).includes('Files')
}

const resetDragImportState = () => {
  logFileDragDepth = 0
  isDraggingLogFiles.value = false
}

const resetLogImportState = () => {
  parseRequestVersion += 1
  logContent.value = null
  logFileName.value = ''
  logDate.value = ''
  resetRangeExportState()
  timelineData.value = []
  selectedTimelineItemKeys.value = []
  lastSelectedTimelineItemKey.value = null
  clearRecordedDiffLogs()

  if (viewRef.value) {
    viewRef.value.dispatch({
      effects: highlightCompartment.reconfigure(EditorView.decorations.of(Decoration.none))
    })
  }
}

const importLogFiles = (files: File[]) => {
  if (files.length === 0) {
    return
  }

  if (loading.value) {
    ElMessage.warning('正在解析日志文件，请稍候')
    return
  }

  loading.value = true
  resetLogImportState()

  // Allow the loading UI to render before reading and parsing large files.
  setTimeout(async () => {
    try {
      const { mergedText, fileCount, firstFileName, firstFileDate } = await readAndMergeLogFiles(files)
      logContent.value = mergedText
      logFileName.value = firstFileName
      logDate.value = firstFileDate

      if (fileCount > 1) {
        ElMessage.success(`已按文件名顺序加载并拼接 ${fileCount} 个日志文件`)
      } else {
        ElMessage.success('日志文件加载完成')
      }

      // Allow CodeMirror to render the doc first before applying decorations.
      setTimeout(() => {
        applyRulesAndParse()
      }, 100)
    } catch (err: unknown) {
      ElMessage.error('读取文件失败: ' + getErrorMessage(err))
      loading.value = false
    }
  }, 50)
}

const handlePageDragEnter = (event: DragEvent) => {
  if (!hasDraggedFiles(event)) {
    return
  }

  event.preventDefault()
  closeMessageBlockContextMenu()
  logFileDragDepth += 1
  isDraggingLogFiles.value = true
}

const handlePageDragOver = (event: DragEvent) => {
  if (!hasDraggedFiles(event)) {
    return
  }

  event.preventDefault()

  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = loading.value ? 'none' : 'copy'
  }
}

const handlePageDragLeave = (event: DragEvent) => {
  if (!hasDraggedFiles(event)) {
    return
  }

  event.preventDefault()
  logFileDragDepth = Math.max(0, logFileDragDepth - 1)

  if (logFileDragDepth === 0) {
    isDraggingLogFiles.value = false
  }
}

const handlePageDrop = (event: DragEvent) => {
  if (!hasDraggedFiles(event)) {
    return
  }

  event.preventDefault()
  resetDragImportState()

  const files = Array.from(event.dataTransfer?.files || [])
  if (!files.length) {
    ElMessage.warning('未检测到可导入的日志文件')
    return
  }

  importLogFiles(files)
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
  document.addEventListener('click', handleDocumentClick)
  window.addEventListener('resize', handleWindowResize)
  window.addEventListener('keydown', handleWindowKeydown)
})

onUnmounted(() => {
  document.title = defaultDocumentTitle
  document.removeEventListener('click', handleDocumentClick)
  window.removeEventListener('resize', handleWindowResize)
  window.removeEventListener('keydown', handleWindowKeydown)
  clearMessageBlockFlash()
  restorePagePadding()
})

const onFileSelected = async (e: Event) => {
  const files = Array.from((e.target as HTMLInputElement).files || [])
  importLogFiles(files)

  // Reset input so the same file could be selected again.
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

const triggerJsonImport = () => {
  jsonFileInput.value?.click()
}

const onJsonFileSelected = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    const text = await file.text()
    const data = JSON.parse(text)
    if (data.ceidMatchMode === 'S6F11' || data.ceidMatchMode === 'S6F3') {
      ceidMatchMode.value = data.ceidMatchMode
    }
    if (data.ceidRules) rulesList.value = data.ceidRules
    if (data.sxfyRules) sxfyList.value = data.sxfyRules
    ElMessage.success('配置导入成功')
    if (logContent.value) applyRulesAndParse()
  } catch (err: unknown) {
    ElMessage.error('读取配置文件失败: ' + getErrorMessage(err))
  }
  if (jsonFileInput.value) jsonFileInput.value.value = ''
}

const exportJsonConfig = () => {
  const data = {
    ceidMatchMode: ceidMatchMode.value,
    ceidRules: rulesList.value,
    sxfyRules: sxfyList.value
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'secs-log-rules.json'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
  ElMessage.success('配置导出成功')
}

const clearAllData = () => {
  ElMessageBox.confirm('确定要清空所有规则和日志数据吗？', '警告', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    parseRequestVersion += 1
    ceidMatchMode.value = 'S6F11'
    rulesList.value = []
    sxfyList.value = [
      { id: 'default-s2f41', s: 2, f: 41, keyPos: '[0][0]', color: '#f97316', enabled: true, desc: 'RCMD' },
      { id: 'default-s7f20', s: 7, f: 20, keyPos: '', color: '#8b5cf6', enabled: true, desc: 'RecipeList' }
    ]
    logContent.value = null
    logFileName.value = ''
    logDate.value = ''
    resetRangeExportState()
    timelineData.value = []
    selectedTimelineItemKeys.value = []
    lastSelectedTimelineItemKey.value = null
    exportSelectedOnly.value = false
    filterSxFy.value = ''
    filterDesc.value = []
    clearRecordedDiffLogs()
    clearRangeMarkers()
    clearMessageBlockFlash()
    if (fileInput.value) fileInput.value.value = ''
    if (viewRef.value) {
      viewRef.value.dispatch({
        effects: highlightCompartment.reconfigure(EditorView.decorations.of(Decoration.none))
      })
    }
    ElMessage.success('已清空所有数据')
  }).catch(() => {})
}

const applyRulesAndParse = () => {
  if (!logContent.value) return
  const currentLogContent = logContent.value
  const requestVersion = ++parseRequestVersion
  loading.value = true

  setTimeout(async () => {
    try {
      const response = await runLogTimelineWorker(createParseWorkerRequest(currentLogContent))

      if (requestVersion !== parseRequestVersion) {
        return
      }

      if (response.type === 'error') {
        throw new Error(response.error)
      }

      timelineData.value = response.timeline
      selectedTimelineItemKeys.value = []
      lastSelectedTimelineItemKey.value = null
      if (viewRef.value) {
        editorTotalLines.value = viewRef.value.state.doc.lines
      }

      if (viewRef.value) {
        editorTotalLines.value = viewRef.value.state.doc.lines
        syncScrollGeometry(viewRef.value)
        updateHighlights()
      }
    } catch (err: unknown) {
      if (requestVersion === parseRequestVersion) {
        ElMessage.error('分析过程中出错: ' + getErrorMessage(err))
      }
    } finally {
      if (requestVersion === parseRequestVersion) {
        loading.value = false
      }
    }
  }, 100)
}

const jumpToLine = (lineNumber: number) => {
  if (viewRef.value && lineNumber > 0) {
    const doc = viewRef.value.state.doc
    if (lineNumber <= doc.lines) {
      const lineData = doc.line(lineNumber)
      viewRef.value.dispatch({
        selection: { anchor: lineData.from },
        effects: EditorView.scrollIntoView(lineData.from, { y: 'center' })
      })
    }
  }
}

const flashMessageBlockByLine = (lineNumber: number) => {
  triggerMessageBlockFlash(findHoveredMessageBlock(lineNumber))
}
</script>

<style scoped>
.custom-textarea :deep(.el-textarea__inner) {
  padding: 0.5rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 0.875rem;
}

/* 覆盖滚动条样式，移除上下箭头带来的高度偏移，并使其呈现平滑的层叠状，从而修复高亮标记的视觉错位 */
:deep(.cm-scroller::-webkit-scrollbar) {
  width: 14px;
  height: 14px;
  background-color: transparent;
}
:deep(.cm-scroller::-webkit-scrollbar-track) {
  background-color: transparent;
}
:deep(.cm-scroller::-webkit-scrollbar-thumb) {
  background-color: rgba(100, 116, 139, 0.8);
  border: 4px solid transparent;
  background-clip: padding-box;
  border-radius: 9999px;
}
:deep(.cm-scroller::-webkit-scrollbar-thumb:hover) {
  background-color: rgba(71, 85, 105, 1);
}
:deep(.cm-scroller::-webkit-scrollbar-corner) {
  background-color: transparent;
}

.log-drop-overlay {
  position: absolute;
  inset: 0;
  z-index: 2500;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px dashed #0ea5e9;
  border-radius: 10px;
  background: rgba(240, 249, 255, 0.78);
  pointer-events: none;
}

.log-drop-overlay__panel {
  padding: 14px 18px;
  border: 1px solid #bae6fd;
  border-radius: 8px;
  background: #ffffff;
  color: #0369a1;
  font-size: 14px;
  font-weight: 600;
  box-shadow: 0 14px 34px rgba(15, 23, 42, 0.14);
}

.log-range-export-button {
  position: absolute;
  right: 18px;
  bottom: 18px;
  z-index: 30;
  width: 44px;
  height: 44px;
  border-radius: 9999px;
  box-shadow: 0 16px 36px rgba(15, 23, 42, 0.24), 0 4px 10px rgba(37, 99, 235, 0.28);
}

.log-block-context-menu {
  position: fixed;
  z-index: 3000;
  min-width: 128px;
  padding: 4px;
  border: 1px solid #dbe3ef;
  border-radius: 6px;
  background: #ffffff;
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.18);
}

.log-block-context-menu__item {
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

.log-block-context-menu__item:hover,
.log-block-context-menu__item:focus-visible {
  background: #eef6ff;
  color: #0369a1;
  outline: none;
}

.log-block-context-menu__item:disabled {
  color: #94a3b8;
  cursor: not-allowed;
}

.log-block-context-menu__item:disabled:hover,
.log-block-context-menu__item:disabled:focus-visible {
  background: transparent;
  color: #94a3b8;
}
</style>

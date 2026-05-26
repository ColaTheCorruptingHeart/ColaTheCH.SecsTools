<template>
  <div ref="pageRoot" class="h-full flex flex-col gap-4" v-loading="loading" element-loading-text="正在解析日志文件，请稍候...">
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
        :extensions="extensions"
        :marker-items="filteredTimelineData"
        :bottom-offset="scrollInfo.bottomOffset"
        :has-view="Boolean(viewRef)"
        :get-marker-color="getMarkerColor"
        :get-scroll-marker-top="getScrollMarkerTop"
        @update:logContent="logContent = $event"
        @ready="handleReady"
        @scroll="handleScroll"
      >
        <template #header-actions>
          <div class="flex items-center gap-2">
            <el-button type="danger" plain @click="clearAllData" size="small">清空数据</el-button>
            <el-button type="primary" @click="triggerUpload" size="small">加载日志文件</el-button>
            <input type="file" ref="fileInput" class="hidden" accept=".log,.txt" multiple @change="onFileSelected" />
          </div>
        </template>
      </LogViewerPanel>

      <!-- Right: Timeline -->
      <TimelinePanel
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
        @jump="jumpToLine"
        @exportLogs="exportMatchedLogs"
        @exportCommandSet="exportMatchedCommandSet"
      />
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
  </div>
</template>

<script setup lang="ts">
import { ref, shallowRef, computed, watch, onMounted, onUnmounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { EditorView, lineNumbers, Decoration } from '@codemirror/view'
import { Compartment, EditorState, Range, Text } from '@codemirror/state'
import JSZip from 'jszip'
import { buildCommandFileBaseName, buildExportedMatchedBlocks, buildUniqueFileName } from './log-timeline/exporters'
import type { CeidMatchMode, RuleItem, SxFyRuleItem, TimelineItem } from './log-timeline/types'
import CeidImportDialog from './log-timeline/components/CeidImportDialog.vue'
import LogViewerPanel from './log-timeline/components/LogViewerPanel.vue'
import RulesPanel from './log-timeline/components/RulesPanel.vue'
import SxFyRuleDialog from './log-timeline/components/SxFyRuleDialog.vue'
import TimelinePanel from './log-timeline/components/TimelinePanel.vue'

const loading = ref(false)
const pageRoot = ref<HTMLDivElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const jsonFileInput = ref<HTMLInputElement | null>(null)

const MAX_IMPORT_BYTES = 20 * 1024 * 1024
const MAX_IMPORT_LINES = 150_000

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
const timelineData = ref<TimelineItem[]>([])
const editorTotalLines = ref(1)
const scrollInfo = ref({ bottomOffset: 0 })
const exportKeepTimeLine = ref(true)
const exportSelectedOnly = ref(false)
const selectedTimelineItemKeys = ref<string[]>([])

const viewRef = shallowRef<EditorView>()

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

  if (totalBytes > MAX_IMPORT_BYTES) {
    throw new Error(`日志文件总大小超过限制（${(MAX_IMPORT_BYTES / 1024 / 1024).toFixed(0)} MB），请拆分后再导入`)
  }

  const texts: string[] = []
  let totalLines = 0

  for (const file of sortedFiles) {
    const text = await file.text()
    totalLines += countLines(text)

    if (totalLines > MAX_IMPORT_LINES) {
      throw new Error(`日志总行数超过限制（${MAX_IMPORT_LINES.toLocaleString()} 行），请拆分后再导入`)
    }

    texts.push(text)
  }

  return {
    mergedText: mergeLogTexts(texts),
    fileCount: sortedFiles.length
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

const toggleTimelineItemChecked = ({ key, checked }: { key: string, checked: boolean }) => {
  const nextKeys = new Set(selectedTimelineItemKeys.value)

  if (checked) {
    nextKeys.add(key)
  } else {
    nextKeys.delete(key)
  }

  selectedTimelineItemKeys.value = Array.from(nextKeys)
}

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

  if (filteredTimelineData.value.length === 0) {
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
const baseTheme = EditorView.theme({
  ".cm-scroller": {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace !important',
    fontSize: '12px'
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
  EditorView.updateListener.of((update) => {
    if (update.geometryChanged || update.docChanged) {
       editorTotalLines.value = update.view.state.doc.lines
       syncScrollGeometry(update.view)
    }
  })
]

const handleReady = (payload: { view: EditorView }) => {
  viewRef.value = payload.view
  if (payload.view && payload.view.state) {
    editorTotalLines.value = payload.view.state.doc.lines
    syncScrollGeometry(payload.view)
  }
}

const handleScroll = () => {
    // Scroll events handled internally or left for expansion
}

const triggerUpload = () => {
  fileInput.value?.click()
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
})

onUnmounted(() => {
  restorePagePadding()
})

const onFileSelected = async (e: Event) => {
  const files = Array.from((e.target as HTMLInputElement).files || [])
  if (files.length === 0) return

  loading.value = true
  parseRequestVersion += 1

  // Reset existing
  logContent.value = null
  timelineData.value = []
  selectedTimelineItemKeys.value = []
  if (viewRef.value) {
    viewRef.value.dispatch({
        effects: highlightCompartment.reconfigure(EditorView.decorations.of(Decoration.none))
    })
  }

  // Use timeout to allow loading UI to render
  setTimeout(async () => {
    try {
      const { mergedText, fileCount } = await readAndMergeLogFiles(files)
      logContent.value = mergedText

      if (fileCount > 1) {
        ElMessage.success(`已按文件名顺序加载并拼接 ${fileCount} 个日志文件`)
      } else {
        ElMessage.success('日志文件加载完成')
      }

      // Allow CodeMirror to render the doc first before applying decorations
      setTimeout(() => {
          applyRulesAndParse()
      }, 100)
    } catch (err: unknown) {
      ElMessage.error('读取文件失败: ' + getErrorMessage(err))
      loading.value = false
    }
    // reset input so the same file could be selected again
    if (fileInput.value) {
        fileInput.value.value = ''
    }
  }, 50)
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
    timelineData.value = []
    selectedTimelineItemKeys.value = []
    exportSelectedOnly.value = false
    filterSxFy.value = ''
    filterDesc.value = []
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
      if (viewRef.value) {
        editorTotalLines.value = viewRef.value.state.doc.lines
      }

      // Apply Highlights
      if (viewRef.value && filteredTimelineData.value.length > 0) {
        editorTotalLines.value = viewRef.value.state.doc.lines
        syncScrollGeometry(viewRef.value)
        const doc = viewRef.value.state.doc

        viewRef.value.dispatch({
          effects: highlightCompartment.reconfigure(EditorView.decorations.of(getHighlightExtension(filteredTimelineData.value, doc)))
        })
      } else if (viewRef.value && filteredTimelineData.value.length === 0) {
        viewRef.value.dispatch({
          effects: highlightCompartment.reconfigure(EditorView.decorations.of(Decoration.none))
        })
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
</style>

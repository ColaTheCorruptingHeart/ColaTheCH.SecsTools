<template>
  <div class="h-full flex flex-col gap-4" v-loading="loading" element-loading-text="正在解析日志文件，请稍候...">
    <!-- Header -->
    <div class="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 flex-none">
       <div class="flex items-center justify-between">
           <div class="flex items-center gap-2">
               <div class="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                   <el-icon class="text-blue-500 text-xl"><Calendar /></el-icon>
               </div>
               <div>
                   <h2 class="text-lg font-semibold text-slate-800 dark:text-gray-100 m-0">SECS日志时间线分析</h2>
                   <p class="text-xs text-slate-500 dark:text-gray-400 m-0 mt-0.5">SECS日志解析，提取并在时间线呈现关键CEID与事件。</p>
               </div>
           </div>
           <div class="flex items-center gap-2">
               <el-button type="danger" plain @click="clearAllData">清空数据</el-button>
               <el-button type="primary" @click="triggerUpload">加载日志文件</el-button>
               <input type="file" ref="fileInput" class="hidden" accept=".log,.txt" @change="onFileSelected" />
           </div>
       </div>
    </div>

    <!-- Main Content -->
    <div class="flex-1 flex flex-col lg:flex-row gap-4 min-h-0">
      <!-- Left: Rules -->
      <div class="lg:w-64 xl:w-72 flex-shrink-0 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col h-[500px] lg:h-full overflow-hidden">
         <!-- CEID Rules -->
         <div class="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 p-2 font-medium text-sm flex justify-between items-center text-slate-600 dark:text-slate-300 flex-none">
             <span>CEID匹配规则</span>
             <el-button size="small" type="primary" plain @click="importDialogVisible = true">导入</el-button>
         </div>
         <div class="flex-1 overflow-auto p-2 custom-scrollbar border-b border-slate-200 dark:border-slate-700 min-h-0">
             <div v-if="rulesList.length > 0" class="flex flex-col gap-2">
                 <div v-for="(rule, index) in rulesList" :key="index" class="flex items-center gap-2 bg-slate-50 dark:bg-slate-900/50 p-1.5 rounded border border-slate-200 dark:border-slate-700 transition-opacity" :class="{ 'opacity-40': rule.enabled === false }">
                     <el-checkbox v-model="rule.enabled" size="small" @change="applyRulesAndParse" style="margin-right: 0;" />
                     <el-color-picker v-model="rule.color" size="small" @change="updateHighlights" :disabled="rule.enabled === false" :predefine="predefineColors" />
                     <div class="flex-1 min-w-0 flex items-baseline gap-1.5 overflow-hidden">
                         <div class="text-[11px] font-mono font-bold text-slate-700 dark:text-slate-200 shrink-0">{{ rule.ceid }}</div>
                         <div class="text-[10px] text-slate-500 dark:text-slate-400 truncate" :title="rule.desc">{{ rule.desc }}</div>
                     </div>
                     <el-button type="danger" link @click="removeRule(index)" class="!p-1">
                         <el-icon><Delete /></el-icon>
                     </el-button>
                 </div>
             </div>
             <el-empty v-else description="暂无规则" :image-size="40" />
         </div>

         <!-- SxFy Rules -->
         <div class="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 p-2 font-medium text-sm flex justify-between items-center text-slate-600 dark:text-slate-300 flex-none">
             <span>SxFy匹配规则</span>
             <el-button size="small" type="primary" plain @click="openSxFyDialog()">添加</el-button>
         </div>
         <div class="flex-1 overflow-auto p-2 custom-scrollbar min-h-0">
             <div v-if="sxfyList.length > 0" class="flex flex-col gap-2">
                 <div v-for="(rule, index) in sxfyList" :key="rule.id" class="flex items-center gap-2 bg-slate-50 dark:bg-slate-900/50 p-1.5 rounded border border-slate-200 dark:border-slate-700 transition-opacity" :class="{ 'opacity-40': rule.enabled === false }">
                     <el-checkbox v-model="rule.enabled" size="small" @change="applyRulesAndParse" style="margin-right: 0;" />
                     <el-color-picker v-model="rule.color" size="small" @change="updateHighlights" :disabled="rule.enabled === false" :predefine="predefineColors" />
                     <div class="flex-1 min-w-0 flex flex-col justify-center overflow-hidden">
                         <div class="text-[11px] font-mono font-bold text-slate-700 dark:text-slate-200 shrink-0">S{{ rule.s }}F{{ rule.f }}</div>
                         <div class="text-[9px] text-slate-500 dark:text-slate-400 truncate" :title="rule.keyPos ? `位置: ${rule.keyPos}` : '任意位置'">{{ rule.keyPos ? `[Pos: ${rule.keyPos}]` : '' }} {{ rule.desc }}</div>
                     </div>
                     <el-button type="primary" link @click="openSxFyDialog(rule)" class="!p-1">
                         <el-icon><Edit /></el-icon>
                     </el-button>
                     <el-button type="danger" link @click="removeSxFyRule(index)" class="!p-1">
                         <el-icon><Delete /></el-icon>
                     </el-button>
                 </div>
             </div>
             <el-empty v-else description="暂无SxFy规则" :image-size="40" />
         </div>

         <!-- Action -->
         <div class="p-2 border-t border-slate-200 dark:border-slate-700 flex-none flex flex-col gap-2 bg-slate-50 dark:bg-slate-900/50">
            <div class="flex gap-2">
                <el-button class="flex-1 !ml-0" size="small" @click="triggerJsonImport">导入规则</el-button>
                <el-button class="flex-1 !ml-0" size="small" @click="exportJsonConfig">导出规则</el-button>
            </div>
            <div class="flex gap-2">
                <el-button class="w-full" size="small" type="primary" @click="applyRulesAndParse" :disabled="!logContent">重新分析全记录</el-button>
            </div>
            <input type="file" ref="jsonFileInput" class="hidden" accept=".json" @change="onJsonFileSelected" />
         </div>
      </div>

      <!-- Middle: CodeMirror Log Viewer -->
      <div class="flex-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col overflow-hidden min-h-[300px] lg:min-h-0">
         <div class="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 px-4 py-2 font-medium text-sm text-slate-600 dark:text-slate-300">日志内容</div>
         <div class="flex-1 overflow-hidden relative group">
            <Codemirror
              v-if="logContent !== null"
              v-model="logContent"
              :style="{ height: '100%' }"
              :extensions="extensions"
              @ready="handleReady"
              @scroll="handleScroll"
            />
            <div v-else class="h-full flex items-center justify-center text-slate-400 text-sm">
               请点击右上角按钮加载日志文件
            </div>

            <!-- Custom Scrollbar Highlights Container -->
            <div
              v-if="logContent !== null && filteredTimelineData.length > 0 && viewRef"
              class="absolute right-0 top-0 w-[14px] pointer-events-none z-10 opacity-100 transition-opacity"
              :style="{ bottom: scrollInfo.bottomOffset + 'px' }"
            >
              <div
                v-for="(item, index) in filteredTimelineData"
                :key="'mark-'+index"
                class="absolute right-[2px] w-[10px] h-[3px] rounded-[1px] opacity-40 group-hover:opacity-60 z-20 transition-all hover:scale-110"
                :style="{ top: getScrollMarkerTop(item.line), backgroundColor: getMarkerColor(item.ceid, item.type, item.ruleId) }"
              ></div>
            </div>
         </div>
      </div>

      <!-- Right: Timeline -->
      <TimelinePanel
        :items="filteredTimelineData"
        :filter-sx-fy="filterSxFy"
        :filter-desc="filterDesc"
        :available-sx-fy-options="availableSxFyOptions"
        :available-desc-options="availableDescOptions"
        :export-keep-time-line="exportKeepTimeLine"
        :can-export="Boolean(filteredTimelineData.length && logContent)"
        :get-marker-color="getMarkerColor"
        @update:filterSxFy="filterSxFy = $event"
        @update:filterDesc="filterDesc = $event"
        @update:exportKeepTimeLine="exportKeepTimeLine = $event"
        @jump="jumpToLine"
        @exportLogs="exportMatchedLogs"
        @exportCommandSet="exportMatchedCommandSet"
      />
    </div>

    <!-- Rule Import Dialog -->
    <el-dialog v-model="importDialogVisible" title="导入 CEID 匹配规则" width="500px">
      <div class="mb-2 text-sm text-slate-500">
        请输入或粘贴 CEID 对应规则，格式为 每行：<code>CEID=描述</code>
      </div>
      <el-input
        v-model="importText"
        type="textarea"
        :rows="8"
        placeholder="例如：\n2300=MappingEnd\n700=PrJobCreated"
      />
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="importDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="confirmImport">确定导入</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- SxFy Import Dialog -->
    <el-dialog v-model="sxfyDialogVisible" :title="isSxFyEdit ? '编辑 SxFy 规则' : '添加 SxFy 规则'" width="450px" destroy-on-close>
      <el-form :model="sxfyForm" label-width="110px" size="default">
        <el-form-item label="Stream (S)">
          <el-input-number v-model="sxfyForm.s" :min="1" :max="99" />
        </el-form-item>
        <el-form-item label="Function (F)">
          <el-input-number v-model="sxfyForm.f" :min="0" :max="99" />
        </el-form-item>
        <el-form-item label="关键值位置">
          <el-input v-model="sxfyForm.keyPos" placeholder="可选，如 [0][1]" />
        </el-form-item>
        <el-form-item label="自定义描述">
          <el-input v-model="sxfyForm.desc" placeholder="为空时自动生成" />
        </el-form-item>
        <el-form-item label="标记颜色">
          <el-color-picker v-model="sxfyForm.color" :predefine="predefineColors" />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="sxfyDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="saveSxFyRule">确定</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, shallowRef, computed, watch } from 'vue'
import { Calendar, Delete, Edit } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Codemirror } from 'vue-codemirror'
import { EditorView, lineNumbers, Decoration } from '@codemirror/view'
import { Compartment, EditorState } from '@codemirror/state'
import JSZip from 'jszip'
import { analyzeLogTimeline } from './log-timeline/parser'
import { buildCommandFileBaseName, buildExportedMatchedBlocks, buildUniqueFileName } from './log-timeline/exporters'
import type { RuleItem, SxFyRuleItem, TimelineItem } from './log-timeline/types'
import TimelinePanel from './log-timeline/components/TimelinePanel.vue'

const loading = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const jsonFileInput = ref<HTMLInputElement | null>(null)

const importDialogVisible = ref(false)
const importText = ref('')

const rulesList = ref<RuleItem[]>([])
const sxfyList = ref<SxFyRuleItem[]>([
  { id: 'default-s2f41', s: 2, f: 41, keyPos: '[0][0]', color: '#f97316', enabled: true, desc: 'RCMD' },
  { id: 'default-s7f20', s: 7, f: 20, keyPos: '', color: '#8b5cf6', enabled: true, desc: 'RecipeList' }
])

const predefineColors = ref([
  '#3b82f6', // blue
  '#ef4444', // red
  '#10b981', // emerald
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // teal
  '#f97316', // orange
  '#6366f1'  // indigo
])

const logContent = ref<string | null>(null)
const timelineData = ref<TimelineItem[]>([])
const editorTotalLines = ref(1)
const scrollInfo = ref({ bottomOffset: 0 })
const exportKeepTimeLine = ref(true)

const viewRef = shallowRef<EditorView>()

const getMarkerColor = (id: string, type: 'CEID' | 'SxFy' = 'CEID', ruleId?: string) => {
  if (type === 'SxFy') {
    const rule = sxfyList.value.find(r => r.id === ruleId) || sxfyList.value.find(r => `S${r.s}F${r.f}` === id || id.startsWith(`S${r.s}F${r.f}`))
    return rule ? rule.color : '#10b981'
  }
  const rule = rulesList.value.find(r => r.ceid === id)
  return rule ? rule.color : '#3b82f6'
}

const filterSxFy = ref<string>('')
const filterDesc = ref<string[]>([])

const availableSxFyOptions = computed(() => {
    const sxfySet = new Set<string>()
    timelineData.value.forEach(item => {
        if (item.type === 'CEID') {
            sxfySet.add('S6F11')
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
    let isMatch = false
    if (item.type === 'CEID' && filterSxFy.value === 'S6F11') {
      isMatch = true
    } else if (item.type === 'SxFy' && item.ceid.startsWith(filterSxFy.value)) {
      isMatch = true
    }
    if (isMatch && item.desc) {
      descSet.add(item.desc)
    }
  })
  return Array.from(descSet).sort()
})

const filteredTimelineData = computed(() => {
  return timelineData.value.filter(item => {
    if (filterSxFy.value) {
      let isMatch = false
      if (item.type === 'CEID' && filterSxFy.value === 'S6F11') {
        isMatch = true
      } else if (item.type === 'SxFy' && item.ceid.startsWith(filterSxFy.value)) {
        isMatch = true
      }
      if (!isMatch) return false
      if (filterDesc.value.length > 0 && !filterDesc.value.includes(item.desc)) return false
    }
    return true
  })
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

const saveSxFyRule = () => {
    if (sxfyForm.value.keyPos) sxfyForm.value.keyPos = sxfyForm.value.keyPos.trim()

    // Conflict Check
    const exists = sxfyList.value.find(r => r.s === sxfyForm.value.s && r.f === sxfyForm.value.f && r.keyPos === sxfyForm.value.keyPos && r.id !== sxfyForm.value.id)
    if (exists) {
        ElMessage.warning('该 SxFy 规则及对应关键值位置已存在，请勿重复添加')
        return
    }

    if (isSxFyEdit.value) {
        const idx = sxfyList.value.findIndex(r => r.id === sxfyForm.value.id)
        if (idx !== -1) {
            sxfyList.value.splice(idx, 1, { ...sxfyForm.value })
        }
    } else {
        sxfyList.value.push({ ...sxfyForm.value })
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

const exportMatchedLogs = () => {
  if (!logContent.value) {
    ElMessage.warning('请先加载日志文件')
    return
  }

  if (!filteredTimelineData.value.length) {
    ElMessage.warning('当前没有可导出的命中记录')
    return
  }

  const exportedBlocks = buildExportedMatchedBlocks(logContent.value, filteredTimelineData.value, exportKeepTimeLine.value)

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
  if (!logContent.value) {
    ElMessage.warning('请先加载日志文件')
    return
  }

  if (!filteredTimelineData.value.length) {
    ElMessage.warning('当前没有可导出的命中记录')
    return
  }

  const exportedBlocks = buildExportedMatchedBlocks(logContent.value, filteredTimelineData.value, exportKeepTimeLine.value)
  if (!exportedBlocks.length) {
    ElMessage.warning('未能根据命中记录生成命令集')
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
    ElMessage.success(`已导出 ${exportedBlocks.length} 条命令集报文压缩包`)
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误'
    ElMessage.error(`导出命令集失败: ${message}`)
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
const getHighlightExtension = (timeline: typeof timelineData.value, doc: any) => {
  const builder: any[] = []
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
  const uniqueBuilder = builder.filter((item, pos, ary) => !pos || item.from !== ary[pos - 1].from)
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

const handleReady = (payload: any) => {
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

const onFileSelected = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return

  loading.value = true

  // Reset existing
  timelineData.value = []
  if (viewRef.value) {
    viewRef.value.dispatch({
        effects: highlightCompartment.reconfigure(EditorView.decorations.of(Decoration.none))
    })
  }

  // Use timeout to allow loading UI to render
  setTimeout(async () => {
    try {
      const text = await file.text()
      logContent.value = text

      // Allow CodeMirror to render the doc first before applying decorations
      setTimeout(() => {
          applyRulesAndParse()
      }, 100)
    } catch (err: any) {
      ElMessage.error('读取文件失败: ' + err.message)
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
    if (data.ceidRules) rulesList.value = data.ceidRules
    if (data.sxfyRules) sxfyList.value = data.sxfyRules
    ElMessage.success('配置导入成功')
    if (logContent.value) applyRulesAndParse()
  } catch (err: any) {
    ElMessage.error('读取配置文件失败: ' + err.message)
  }
  if (jsonFileInput.value) jsonFileInput.value.value = ''
}

const exportJsonConfig = () => {
  const data = {
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
    rulesList.value = []
    sxfyList.value = []
    logContent.value = null
    timelineData.value = []
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
  loading.value = true

  setTimeout(() => {
    try {
      timelineData.value = analyzeLogTimeline(currentLogContent, rulesList.value, sxfyList.value)
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
    } catch (err: any) {
      ElMessage.error('分析过程中出错: ' + err.message)
    } finally {
      loading.value = false
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

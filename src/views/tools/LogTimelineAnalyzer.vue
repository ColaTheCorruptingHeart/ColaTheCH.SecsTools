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
                   <h2 class="text-lg font-semibold text-slate-800 dark:text-gray-100 m-0">日志时间线分析</h2>
                   <p class="text-xs text-slate-500 dark:text-gray-400 m-0 mt-0.5">解析大型SECS日志，提取并在时间线呈现关键CEID与事件。</p>
               </div>
           </div>
           <div class="flex items-center gap-2">
               <el-button type="primary" @click="triggerUpload">加载日志文件</el-button>
               <input type="file" ref="fileInput" class="hidden" accept=".log,.txt" @change="onFileSelected" />
           </div>
       </div>
    </div>

    <!-- Main Content -->
    <div class="flex-1 flex flex-col lg:flex-row gap-4 min-h-0">
      <!-- Left: Rules -->
      <div class="lg:w-64 xl:w-72 flex-shrink-0 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col h-64 lg:h-full">
         <div class="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 p-2 font-medium text-sm flex justify-between items-center text-slate-600 dark:text-slate-300">
             <span>匹配规则 (CEID=描述)</span>
             <el-button size="small" type="primary" plain @click="applyRulesAndParse" :disabled="!logContent">重新分析</el-button>
         </div>
         <el-input
           v-model="rulesText"
           type="textarea"
           class="flex-1 custom-textarea"
           :input-style="{ height: '100%', resize: 'none', border: 'none', boxShadow: 'none' }"
           placeholder="2300=MappingEnd&#10;700=PrJobCreated"
         />
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
              v-if="logContent !== null && timelineData.length > 0 && viewRef"
              class="absolute right-0 top-0 w-[14px] pointer-events-none z-10 opacity-85 group-hover:opacity-100 transition-opacity"
              :style="{ bottom: scrollInfo.bottomOffset + 'px' }"
            >
              <div 
                v-for="(item, index) in timelineData" 
                :key="'mark-'+index"
                class="absolute right-[2px] w-[10px] h-[3px] rounded-[1px] opacity-90 z-20 transition-all hover:scale-110"
                :style="{ top: getScrollMarkerTop(item.line), backgroundColor: getMarkerColor(item.ceid) }"
              ></div>
            </div>
         </div>
      </div>

      <!-- Right: Timeline -->
      <div class="lg:w-72 xl:w-80 flex-shrink-0 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col overflow-hidden h-72 lg:h-full">
         <div class="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 p-2 px-4 font-medium text-sm flex justify-between items-center text-slate-600 dark:text-slate-300 shrink-0">
             <span>时间线</span>
             <el-tag size="small" type="info" round>找到 {{ timelineData.length }} 条记录</el-tag>
         </div>
         <div class="flex-1 overflow-auto p-4 custom-scrollbar">
             <div v-if="timelineData.length" class="flex flex-col gap-2">
                 <div
                     v-for="(item, index) in timelineData"
                     :key="index"
                     class="cursor-pointer border-l-[3px] p-2 rounded-r transition-colors group flex flex-col gap-1 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                     :style="{ borderLeftColor: getMarkerColor(item.ceid) }"
                     @click="jumpToLine(item.line)"
                 >
                     <div class="flex justify-between items-center gap-2">
                         <span class="text-[11px] text-slate-400 font-mono tracking-tight shrink-0">{{ item.time }}</span>
                         <span 
                            class="text-[10px] px-1.5 py-0.5 rounded font-mono truncate border"
                            :style="{ 
                              color: getMarkerColor(item.ceid),
                              backgroundColor: getMarkerColor(item.ceid) + '20',
                              borderColor: getMarkerColor(item.ceid) + '40'
                            }"
                         >CEID: {{ item.ceid }}</span>
                     </div>
                     <div class="text-sm font-medium text-slate-700 dark:text-slate-200 group-hover:opacity-80 leading-tight">
                         {{ item.desc }}
                     </div>
                 </div>
             </div>
             <el-empty v-else description="暂无符合规则的数据" :image-size="60" />
         </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, shallowRef } from 'vue'
import { Calendar } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { Codemirror } from 'vue-codemirror'
import { EditorView, lineNumbers, Decoration } from '@codemirror/view'
import { Compartment, EditorState } from '@codemirror/state'

const loading = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

const rulesText = ref(`2300=MappingEnd
700=PrJobCreated
301=AGVPPSelected
702=AGVPrJobStarted
800=AGVWaferProcessingStrated
801=AGVWaferEndProcessing
802=AGVWaferIncompleteEnd
805=AGVWaferUnProcessEnd
806=AGVWaferLostEnd
708=AGVPrJobEnded
4368=StepLotStart
4369=StepLotEnd
16777492=AGVPortSensorONLOC1
16777493=AGVPortSensorOFFLOC1
16777748=AGVPortSensorONLOC2
16777749=AGVPortSensorOFFLOC2
16778004=AGVPortSensorONLOC3
16778005=AGVPortSensorOFFLOC3
100=AGVControlStateOFFLINE
101=AGVControlStateLOCAL
102=AGVControlStateREMOTE
78=HostMonitoring
79=HostControl
80=DualControl
2002=StepperInline
2003=StepperLocal`)

const logContent = ref<string | null>(null)
const timelineData = ref<{time: string, ceid: string, desc: string, line: number}[]>([])
const editorTotalLines = ref(1)
const scrollInfo = ref({ bottomOffset: 0 })

const viewRef = shallowRef<EditorView>()

// Pre-defined palette for different CEIDs to ensure consistent and color-coded mapping
const colorPalette = [
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
]

// Assigns a consistent color to a specific CEID
const ceidColorCache = new Map<string, string>()
let colorIndex = 0

const getMarkerColor = (ceid: string) => {
  if (!ceidColorCache.has(ceid)) {
    ceidColorCache.set(ceid, colorPalette[colorIndex % colorPalette.length])
    colorIndex++
  }
  return ceidColorCache.get(ceid)!
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
      const color = getMarkerColor(item.ceid)
      
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

const applyRulesAndParse = () => {
  if (!logContent.value) return
  loading.value = true
  
  setTimeout(() => {
    try {
      const ruleMap = new Map<string, string>()
      rulesText.value.split('\n').forEach(line => {
        const parts = line.split('=')
        if (parts.length === 2 && parts[0].trim() !== '') {
          ruleMap.set(parts[0].trim(), parts[1].trim())
        }
      })

      const lines = logContent.value.split('\n')
      const timeline: typeof timelineData.value = []
      
      let s6f11BlockLine = -1
      let s6f11Time = ''
      let listDepth = 0
      let elementIndexAtDepth1 = -1

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        
        // Match start of S6F11
        const headerMatch = line.match(/^(\d{2}:\d{2}:\d{2}\.\d{3})\s+(?:SEND|RECV)\s+S6F11/i)
        if (headerMatch) {
          s6f11BlockLine = i + 1
          s6f11Time = headerMatch[1]
          listDepth = 0
          elementIndexAtDepth1 = -1
          continue
        }

        if (s6f11BlockLine !== -1) {
          const lineTrim = line.trim()
          
          // Check if another message header unexpectedly started
          if (lineTrim.match(/^(\d{2}:\d{2}:\d{2}\.\d{3})\s+(?:SEND|RECV)/)) {
            s6f11BlockLine = -1
            i-- // Re-evaluate this line in the next iteration
            continue
          }

          if (lineTrim.startsWith('<L')) {
            if (listDepth === 1) elementIndexAtDepth1++
            listDepth++
          } else if (lineTrim.startsWith('>')) {
            listDepth--
            if (listDepth <= 0) s6f11BlockLine = -1
          } else if (lineTrim.startsWith('<')) {
            if (listDepth === 1) {
              elementIndexAtDepth1++
              if (elementIndexAtDepth1 === 1) { // Reached [0][1] relative to the parent <L
                const valMatch = lineTrim.match(/'([^']+)'/)
                if (valMatch) {
                  const ceidStr = valMatch[1].trim()
                  if (ruleMap.has(ceidStr)) {
                    timeline.push({
                      time: s6f11Time,
                      ceid: ceidStr,
                      desc: ruleMap.get(ceidStr)!,
                      line: i + 1 // The specific line the CEID is at
                    })
                  }
                }
                // Once we checked the CEID, we stop searching this block 
                s6f11BlockLine = -1
              }
            }
          }
        }
      }
      
      timelineData.value = timeline
      if (viewRef.value) {
        editorTotalLines.value = viewRef.value.state.doc.lines
      }

      // Apply Highlights
      if (viewRef.value && timeline.length > 0) {
        editorTotalLines.value = viewRef.value.state.doc.lines
        syncScrollGeometry(viewRef.value)
        const doc = viewRef.value.state.doc
        
        viewRef.value.dispatch({
          effects: highlightCompartment.reconfigure(EditorView.decorations.of(getHighlightExtension(timeline, doc)))
        })
      } else if (viewRef.value && timeline.length === 0) {
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
  background-color: rgba(148, 163, 184, 0.4);
  border: 4px solid transparent;
  background-clip: padding-box;
  border-radius: 9999px;
}
:deep(.cm-scroller::-webkit-scrollbar-thumb:hover) {
  background-color: rgba(148, 163, 184, 0.7);
}
:deep(.cm-scroller::-webkit-scrollbar-corner) {
  background-color: transparent;
}
</style>
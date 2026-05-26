<template>
  <div class="flex-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col overflow-hidden min-h-75 lg:min-h-0">
    <div class="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 px-4 py-2 flex items-center justify-between gap-3">
      <div class="font-medium text-sm text-slate-600 dark:text-slate-300">日志内容</div>
      <slot name="header-actions"></slot>
    </div>
    <div class="flex-1 overflow-hidden relative group">
      <div
        v-if="logContent !== null && performanceHint"
        class="pointer-events-none absolute top-3 right-4 z-20 rounded bg-slate-900/75 px-2 py-1 text-[11px] text-white shadow-sm"
      >
        {{ performanceHint }}
      </div>

      <Codemirror
        v-if="logContent !== null"
        v-model="logContentModel"
        :style="{ height: '100%' }"
        :extensions="extensions"
        @ready="emit('ready', $event)"
        @scroll="emit('scroll')"
      />
      <div v-else class="h-full flex items-center justify-center text-slate-400 text-sm">
        请点击上方按钮加载日志文件
      </div>

      <div
        v-if="logContent !== null && markerItems.length > 0 && hasView"
        class="absolute top-0 right-0 w-3.5 pointer-events-none z-10 opacity-100 transition-opacity"
        :style="{ bottom: bottomOffset + 'px' }"
      >
        <div
          v-for="(item, index) in markerItems"
          :key="'mark-' + index"
          class="absolute right-0.5 z-20 h-0.75 w-2.5 rounded-[1px] opacity-40 transition-all group-hover:opacity-60 hover:scale-110"
          :style="{ top: getScrollMarkerTop(item.line), backgroundColor: getMarkerColor(item.ceid, item.type, item.ruleId) }"
        ></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Codemirror } from 'vue-codemirror'
import type { Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import type { TimelineItem } from '../types'

const props = defineProps<{
  logContent: string | null
  extensions: Extension[]
  markerItems: TimelineItem[]
  bottomOffset: number
  hasView: boolean
  performanceHint: string
  getMarkerColor: (id: string, type?: 'CEID' | 'SxFy', ruleId?: string) => string
  getScrollMarkerTop: (line: number) => string
}>()

const emit = defineEmits<{
  'update:logContent': [value: string]
  ready: [payload: { view: EditorView }]
  scroll: []
}>()

const logContentModel = computed({
  get: () => props.logContent ?? '',
  set: (value: string) => {
    emit('update:logContent', value)
  }
})
</script>

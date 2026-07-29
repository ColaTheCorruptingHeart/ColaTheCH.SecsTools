<template>
  <div class="lg:w-72 xl:w-80 shrink-0 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col overflow-hidden h-72 lg:h-full">
    <div class="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 font-medium text-sm flex flex-col text-slate-600 dark:text-slate-300 shrink-0">
      <div class="p-2 px-4 flex justify-between items-center">
        <span>时间线</span>
        <el-tag size="small" type="info" round>找到 {{ items.length }} 条记录</el-tag>
      </div>
      <div class="px-2 pb-2 flex gap-2">
        <el-select v-model="filterSxFyModel" size="small" placeholder="SxFy过滤" clearable class="flex-1">
          <el-option v-for="opt in availableSxFyOptions" :key="opt" :label="opt" :value="opt" />
        </el-select>
        <el-select v-model="filterDescModel" size="small" placeholder="关键值过滤" clearable multiple collapse-tags collapse-tags-tooltip class="flex-1" :disabled="!filterSxFyModel">
          <el-option v-for="opt in availableDescOptions" :key="opt" :label="opt" :value="opt" />
        </el-select>
      </div>
    </div>

    <div
      ref="timelineViewportRef"
      class="flex-1 overflow-auto p-4 custom-scrollbar"
      @scroll="handleViewportScroll"
      @contextmenu.prevent="openTimelineContextMenu(null, $event)"
    >
      <div v-if="items.length" :style="{ height: totalListHeight + 'px', position: 'relative' }">
        <div
          v-for="virtualItem in visibleItems"
          :key="getItemKey(virtualItem.item)"
          class="absolute left-0 right-0"
          :style="{ top: virtualItem.top + 'px', height: ITEM_HEIGHT + 'px' }"
        >
          <div
            class="h-17 cursor-pointer border-l-[3px] p-2 rounded-r transition-colors group flex flex-col gap-1 hover:bg-slate-50 dark:hover:bg-slate-700/50"
            :class="{ 'timeline-item--flashing': getItemKey(virtualItem.item) === flashingItemKey }"
            :style="{ borderLeftColor: getMarkerColor(virtualItem.item.ceid, virtualItem.item.type, virtualItem.item.ruleId) }"
            @click="emit('jump', virtualItem.item.line)"
            @dblclick="emit('flashMessageBlock', virtualItem.item.line)"
            @contextmenu.prevent.stop="openTimelineContextMenu(virtualItem.item, $event)"
          >
            <div class="flex justify-between items-center gap-2">
              <span class="text-[11px] text-slate-600 font-mono tracking-tight shrink-0">{{ virtualItem.item.time }}</span>
              <div class="flex items-center gap-2 min-w-0">
                <span
                  class="text-[10px] px-1.5 py-0.5 rounded font-mono truncate border"
                  :style="{
                    color: getMarkerColor(virtualItem.item.ceid, virtualItem.item.type, virtualItem.item.ruleId),
                    backgroundColor: getMarkerColor(virtualItem.item.ceid, virtualItem.item.type, virtualItem.item.ruleId) + '20',
                    borderColor: getMarkerColor(virtualItem.item.ceid, virtualItem.item.type, virtualItem.item.ruleId) + '40'
                  }"
                >{{ virtualItem.item.type === 'CEID' ? 'CEID' : 'SxFy' }}: {{ virtualItem.item.ceid }}</span>
                <el-checkbox
                  :model-value="selectedItemKeySet.has(getItemKey(virtualItem.item))"
                  @click.stop="handleItemCheckboxClick(virtualItem.item, $event)"
                  @change="handleItemCheckedChange(virtualItem.item, Boolean($event))"
                />
              </div>
            </div>
            <div class="timeline-item-desc text-sm font-medium text-slate-700 dark:text-slate-200 group-hover:opacity-80 leading-tight">
              {{ virtualItem.item.desc }}
            </div>
          </div>
        </div>
      </div>
      <el-empty v-else description="暂无符合规则的数据" :image-size="60" />
    </div>

    <div class="p-2 border-t border-slate-200 dark:border-slate-700 flex-none flex flex-col gap-2 bg-slate-50 dark:bg-slate-900/50">
      <div class="flex items-center gap-4 flex-wrap">
        <el-checkbox v-model="exportKeepTimeLineModel" size="small">保留时间行</el-checkbox>
        <el-checkbox v-model="exportSelectedOnlyModel" size="small">只导出已勾选报文</el-checkbox>
      </div>
      <div class="flex gap-2">
        <el-button class="ml-0! flex-1" size="small" type="primary" :disabled="!canExport" @click="emit('exportLogs')">
          <el-icon class="mr-1"><Download /></el-icon>
          导出命中报文
        </el-button>
        <el-button class="ml-0! flex-1" size="small" plain :disabled="!canExport" @click="emit('exportCommandSet')">
          <el-icon class="mr-1"><Download /></el-icon>
          导出报文集
        </el-button>
      </div>
    </div>

    <div
      v-if="timelineContextMenu.visible"
      class="timeline-context-menu"
      :style="{ left: timelineContextMenu.left + 'px', top: timelineContextMenu.top + 'px' }"
      @click.stop
      @contextmenu.prevent.stop
    >
      <button class="timeline-context-menu__item" type="button" :disabled="!items.length" @click="handleContextMenuAction('selectAll')">
        全选
      </button>
      <button class="timeline-context-menu__item" type="button" :disabled="!items.length" @click="handleContextMenuAction('clearAll')">
        取消全选
      </button>
      <button class="timeline-context-menu__item" type="button" :disabled="!timelineContextMenu.item?.sxFy" @click="handleContextMenuAction('selectSameSxFy')">
        选择同SxFy
      </button>
      <button class="timeline-context-menu__item" type="button" :disabled="!timelineContextMenu.item?.ceid" @click="handleContextMenuAction('selectSameCeid')">
        选择同CEID
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { Download } from '@element-plus/icons-vue'
import type { TimelineItem } from '../types'

const ITEM_HEIGHT = 76
const OVERSCAN_COUNT = 6

const props = defineProps<{
  items: TimelineItem[]
  selectedItemKeys: string[]
  filterSxFy: string
  filterDesc: string[]
  availableSxFyOptions: string[]
  availableDescOptions: string[]
  exportKeepTimeLine: boolean
  exportSelectedOnly: boolean
  canExport: boolean
  getMarkerColor: (id: string, type?: 'CEID' | 'SxFy', ruleId?: string) => string
  getItemKey: (item: TimelineItem) => string
}>()

const emit = defineEmits<{
  jump: [lineNumber: number]
  flashMessageBlock: [lineNumber: number]
  toggleItemChecked: [payload: { key: string, checked: boolean, shiftKey: boolean }]
  timelineContextAction: [payload: { action: 'selectAll' | 'clearAll' | 'selectSameSxFy' | 'selectSameCeid', key?: string }]
  timelineContextMenuOpened: []
  exportLogs: []
  exportCommandSet: []
  'update:filterSxFy': [value: string]
  'update:filterDesc': [value: string[]]
  'update:exportKeepTimeLine': [value: boolean]
  'update:exportSelectedOnly': [value: boolean]
}>()

const selectedItemKeySet = computed(() => {
  return new Set(props.selectedItemKeys)
})

const timelineViewportRef = ref<HTMLDivElement | null>(null)
const viewportHeight = ref(0)
const scrollTop = ref(0)
const timelineContextMenu = ref<{
  visible: boolean
  left: number
  top: number
  item: TimelineItem | null
}>({
  visible: false,
  left: 0,
  top: 0,
  item: null
})

let resizeObserver: ResizeObserver | null = null
const flashingItemKey = ref('')
let flashTimer: number | undefined

const visibleRange = computed(() => {
  if (!props.items.length) {
    return { start: 0, end: 0 }
  }

  const visibleCount = Math.max(1, Math.ceil((viewportHeight.value || ITEM_HEIGHT) / ITEM_HEIGHT))
  const start = Math.max(0, Math.floor(scrollTop.value / ITEM_HEIGHT) - OVERSCAN_COUNT)
  const end = Math.min(props.items.length, start + visibleCount + OVERSCAN_COUNT * 2)

  return { start, end }
})

const visibleItems = computed(() => {
  const { start, end } = visibleRange.value
  return props.items.slice(start, end).map((item, index) => {
    const absoluteIndex = start + index
    return {
      item,
      top: absoluteIndex * ITEM_HEIGHT
    }
  })
})

const totalListHeight = computed(() => {
  return props.items.length * ITEM_HEIGHT
})

const lastCheckboxClick = ref<{ key: string, shiftKey: boolean } | null>(null)

const handleItemCheckboxClick = (item: TimelineItem, event: MouseEvent) => {
  lastCheckboxClick.value = {
    key: props.getItemKey(item),
    shiftKey: event.shiftKey
  }
}

const handleItemCheckedChange = (item: TimelineItem, checked: boolean) => {
  const key = props.getItemKey(item)
  const shiftKey = lastCheckboxClick.value?.key === key ? lastCheckboxClick.value.shiftKey : false

  lastCheckboxClick.value = null
  emit('toggleItemChecked', { key, checked, shiftKey })
}

const getContextMenuPosition = (event: MouseEvent) => {
  const menuWidth = 136
  const menuHeight = 148
  const margin = 8

  return {
    left: Math.max(margin, Math.min(event.clientX, window.innerWidth - menuWidth - margin)),
    top: Math.max(margin, Math.min(event.clientY, window.innerHeight - menuHeight - margin))
  }
}

const openTimelineContextMenu = (item: TimelineItem | null, event: MouseEvent) => {
  const position = getContextMenuPosition(event)

  emit('timelineContextMenuOpened')
  timelineContextMenu.value = {
    visible: true,
    left: position.left,
    top: position.top,
    item
  }
}

const closeTimelineContextMenu = () => {
  if (!timelineContextMenu.value.visible) {
    return
  }

  timelineContextMenu.value = {
    visible: false,
    left: 0,
    top: 0,
    item: null
  }
}

const handleContextMenuAction = (action: 'selectAll' | 'clearAll' | 'selectSameSxFy' | 'selectSameCeid') => {
  const item = timelineContextMenu.value.item
  emit('timelineContextAction', {
    action,
    key: item ? props.getItemKey(item) : undefined
  })
  closeTimelineContextMenu()
}

const syncViewportMetrics = () => {
  if (!timelineViewportRef.value) {
    return
  }

  viewportHeight.value = timelineViewportRef.value.clientHeight
  scrollTop.value = timelineViewportRef.value.scrollTop
}

const handleViewportScroll = () => {
  if (!timelineViewportRef.value) {
    return
  }

  scrollTop.value = timelineViewportRef.value.scrollTop
  closeTimelineContextMenu()
}

const centerAndFlashItem = (key: string) => {
  const itemIndex = props.items.findIndex(item => props.getItemKey(item) === key)
  if (itemIndex < 0 || !timelineViewportRef.value) {
    return
  }

  const nextScrollTop = Math.max(0, itemIndex * ITEM_HEIGHT - Math.max(0, viewportHeight.value - ITEM_HEIGHT) / 2)
  timelineViewportRef.value.scrollTop = nextScrollTop
  scrollTop.value = nextScrollTop

  if (flashTimer !== undefined) {
    window.clearTimeout(flashTimer)
    flashTimer = undefined
  }

  flashingItemKey.value = ''
  window.requestAnimationFrame(() => {
    flashingItemKey.value = key
    flashTimer = window.setTimeout(() => {
      if (flashingItemKey.value === key) {
        flashingItemKey.value = ''
      }
      flashTimer = undefined
    }, 1800)
  })
}

const handleDocumentClick = () => {
  closeTimelineContextMenu()
}

const handleWindowKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    closeTimelineContextMenu()
  }
}

onMounted(() => {
  syncViewportMetrics()
  document.addEventListener('click', handleDocumentClick)
  window.addEventListener('keydown', handleWindowKeydown)

  if (!timelineViewportRef.value) {
    return
  }

  resizeObserver = new ResizeObserver(() => {
    syncViewportMetrics()
  })
  resizeObserver.observe(timelineViewportRef.value)
})

onUnmounted(() => {
  document.removeEventListener('click', handleDocumentClick)
  window.removeEventListener('keydown', handleWindowKeydown)
  if (flashTimer !== undefined) {
    window.clearTimeout(flashTimer)
  }
  resizeObserver?.disconnect()
  resizeObserver = null
})

defineExpose({
  centerAndFlashItem
})

const filterSxFyModel = computed({
  get: () => props.filterSxFy,
  set: (value: string | null | undefined) => {
    emit('update:filterSxFy', value || '')
  }
})

const filterDescModel = computed({
  get: () => props.filterDesc,
  set: (value: string[] | undefined) => {
    emit('update:filterDesc', value ?? [])
  }
})

const exportKeepTimeLineModel = computed({
  get: () => props.exportKeepTimeLine,
  set: (value: boolean) => {
    emit('update:exportKeepTimeLine', value)
  }
})

const exportSelectedOnlyModel = computed({
  get: () => props.exportSelectedOnly,
  set: (value: boolean) => {
    emit('update:exportSelectedOnly', value)
  }
})
</script>

<style scoped>
.timeline-item-desc {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.timeline-item--flashing {
  animation: timeline-item-flash 0.55s ease-in-out 3;
}

@keyframes timeline-item-flash {
  0%,
  100% {
    background-color: transparent;
  }

  50% {
    background-color: #dbeafe;
  }
}

.timeline-context-menu {
  position: fixed;
  z-index: 3000;
  min-width: 128px;
  padding: 4px;
  border: 1px solid #dbe3ef;
  border-radius: 6px;
  background: #ffffff;
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.18);
}

.timeline-context-menu__item {
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

.timeline-context-menu__item:hover,
.timeline-context-menu__item:focus-visible {
  background: #eef6ff;
  color: #0369a1;
  outline: none;
}

.timeline-context-menu__item:disabled {
  color: #94a3b8;
  cursor: not-allowed;
}

.timeline-context-menu__item:disabled:hover,
.timeline-context-menu__item:disabled:focus-visible {
  background: transparent;
  color: #94a3b8;
}
</style>

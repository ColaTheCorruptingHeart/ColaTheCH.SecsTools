<template>
  <aside class="diff-nav">
    <header class="diff-nav__header">
      <div>
        <h2>差异导航</h2>
      </div>
      <el-select :model-value="filter" size="small" class="diff-nav__filter" @update:model-value="emit('update:filter', $event)">
        <el-option label="全部" value="all" />
        <el-option label="新增" value="added" />
        <el-option label="缺失" value="missing" />
        <el-option label="字段变化" value="field_changed" />
        <el-option label="ACK 异常" value="ack_error" />
        <el-option label="原文变化" value="changed" />
        <el-option label="解析失败" value="parse_error" />
      </el-select>
    </header>

    <div ref="viewportRef" class="diff-nav__list" @scroll="handleScroll">
      <div v-if="visibleRows.length" :style="{ height: totalListHeight + 'px', position: 'relative' }">
        <div
          v-for="virtualItem in renderedItems"
          :key="virtualItem.row.id"
          class="diff-nav__item-wrap"
          :style="{ top: virtualItem.top + 'px', height: ITEM_HEIGHT + 'px' }"
        >
          <button
            type="button"
            class="diff-nav__item"
            :class="[
              `diff-nav__item--${virtualItem.row.kind}`,
              {
                'is-active': virtualItem.row.id === selectedRowId,
                'is-flashing': virtualItem.row.id === flashingRowId
              }
            ]"
            @click="emit('select', virtualItem.row.id)"
            @dblclick="emit('open-detail', virtualItem.row.id)"
          >
            <span class="diff-nav__index">{{ getRowNumber(virtualItem.row.id) }}</span>
            <span class="diff-nav__tag">{{ getKindLabel(virtualItem.row.kind) }}</span>
            <span class="diff-nav__title">{{ virtualItem.row.title }}</span>
            <span class="diff-nav__lines">
              {{ virtualItem.row.ackSummary || `L ${virtualItem.row.baselineOriginalLine || '-'} / R ${virtualItem.row.targetOriginalLine || '-'}` }}
            </span>
          </button>
        </div>
      </div>
      <el-empty v-else description="暂无差异项" :image-size="56" />
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { SecsDiffRenderRow, SecsLogDiffKind } from '../types'

const ITEM_HEIGHT = 76
const OVERSCAN_COUNT = 6

const props = defineProps<{
  rows: SecsDiffRenderRow[]
  selectedRowId: string
  filter: SecsLogDiffKind | 'all'
}>()

const emit = defineEmits<{
  select: [rowId: string]
  'open-detail': [rowId: string]
  'update:filter': [value: SecsLogDiffKind | 'all']
}>()

const viewportRef = ref<HTMLDivElement | null>(null)
const viewportHeight = ref(0)
const scrollTop = ref(0)
const flashingRowId = ref('')
let resizeObserver: ResizeObserver | null = null
let flashTimer: number | undefined

const diffRows = computed(() => props.rows.filter(row => row.kind !== 'equal'))

const visibleRows = computed(() => {
  if (props.filter === 'all') {
    return diffRows.value
  }

  return diffRows.value.filter(row => row.kind === props.filter)
})

const visibleRange = computed(() => {
  if (!visibleRows.value.length) {
    return { start: 0, end: 0 }
  }

  const visibleCount = Math.max(1, Math.ceil((viewportHeight.value || ITEM_HEIGHT) / ITEM_HEIGHT))
  const start = Math.max(0, Math.floor(scrollTop.value / ITEM_HEIGHT) - OVERSCAN_COUNT)
  const end = Math.min(visibleRows.value.length, start + visibleCount + OVERSCAN_COUNT * 2)
  return { start, end }
})

const renderedItems = computed(() => {
  const { start, end } = visibleRange.value
  return visibleRows.value.slice(start, end).map((row, index) => ({
    row,
    top: (start + index) * ITEM_HEIGHT
  }))
})

const totalListHeight = computed(() => visibleRows.value.length * ITEM_HEIGHT)

const rowNumberMap = computed(() => {
  return new Map(diffRows.value.map((row, index) => [row.id, index + 1]))
})

function getRowNumber(rowId: string) {
  return rowNumberMap.value.get(rowId)?.toLocaleString() || '-'
}

function getKindLabel(kind: SecsLogDiffKind) {
  const labels: Record<SecsLogDiffKind, string> = {
    equal: '一致',
    added: '新增',
    missing: '缺失',
    changed: '变化',
    field_changed: '字段',
    ack_error: 'ACK',
    parse_error: '解析'
  }
  return labels[kind]
}

function handleScroll() {
  scrollTop.value = viewportRef.value?.scrollTop || 0
}

function centerAndFlash(rowId: string) {
  const rowIndex = visibleRows.value.findIndex(row => row.id === rowId)
  if (rowIndex === -1 || !viewportRef.value) {
    return
  }

  const nextScrollTop = Math.max(0, rowIndex * ITEM_HEIGHT - Math.max(0, viewportHeight.value - ITEM_HEIGHT) / 2)
  viewportRef.value.scrollTop = nextScrollTop
  scrollTop.value = nextScrollTop

  if (flashTimer !== undefined) {
    window.clearTimeout(flashTimer)
    flashTimer = undefined
  }

  flashingRowId.value = ''
  window.requestAnimationFrame(() => {
    flashingRowId.value = rowId
    flashTimer = window.setTimeout(() => {
      if (flashingRowId.value === rowId) {
        flashingRowId.value = ''
      }
      flashTimer = undefined
    }, 1800)
  })
}

onMounted(() => {
  if (viewportRef.value) {
    viewportHeight.value = viewportRef.value.clientHeight
    resizeObserver = new ResizeObserver(entries => {
      const entry = entries[0]
      if (entry) {
        viewportHeight.value = entry.contentRect.height
      }
    })
    resizeObserver.observe(viewportRef.value)
  }
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  if (flashTimer !== undefined) {
    window.clearTimeout(flashTimer)
  }
})

defineExpose({
  centerAndFlash
})
</script>

<style scoped>
.diff-nav {
  display: flex;
  width: 290px;
  min-height: 0;
  flex: 0 0 290px;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #ffffff;
}

.diff-nav__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
  padding: 9px 10px;
}

.diff-nav__header h2 {
  margin: 0;
  color: #334155;
  font-size: 14px;
  font-weight: 700;
  line-height: 20px;
}

.diff-nav__header p {
  margin: 0;
  color: #94a3b8;
  font-size: 12px;
  line-height: 16px;
}

.diff-nav__filter {
  width: 100px;
}

.diff-nav__list {
  min-height: 0;
  flex: 1;
  overflow: auto;
  padding: 10px 6px;
}

.diff-nav__item-wrap {
  position: absolute;
  left: 3px;
  right: 3px;
}

.diff-nav__item {
  display: grid;
  width: 100%;
  height: 68px;
  grid-template-columns: auto auto minmax(0, 1fr);
  grid-template-rows: auto auto;
  gap: 4px 8px;
  align-content: center;
  border-left-width: 4px;
  border-left-style: solid;
  border-left-color: transparent;
  border-right: 0;
  border-top: 0;
  border-bottom: 0;
  border-radius: 0 6px 6px 0;
  background: transparent;
  padding: 8px 10px 8px 10px;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
}

.diff-nav__item:hover,
.diff-nav__item.is-active {
  background: #f8fafc;
}

.diff-nav__item.is-flashing {
  animation: diff-nav-flash 0.55s ease-in-out 3;
}

.diff-nav__item--added.is-flashing {
  animation-name: diff-nav-flash-added;
}

.diff-nav__item--missing.is-flashing {
  animation-name: diff-nav-flash-missing;
}

.diff-nav__item--changed.is-flashing,
.diff-nav__item--field_changed.is-flashing {
  animation-name: diff-nav-flash-changed;
}

.diff-nav__item--ack_error.is-flashing {
  animation-name: diff-nav-flash-ack-error;
}

.diff-nav__item--parse_error.is-flashing {
  animation-name: diff-nav-flash-parse-error;
}

@keyframes diff-nav-flash {
  0%,
  100% {
    background: #f8fafc;
  }

  50% {
    background: #dbeafe;
  }
}

@keyframes diff-nav-flash-added {
  0%,
  100% {
    background: #f0fdf4;
  }

  50% {
    background: #bbf7d0;
  }
}

@keyframes diff-nav-flash-missing {
  0%,
  100% {
    background: #fef2f2;
  }

  50% {
    background: #fecaca;
  }
}

@keyframes diff-nav-flash-changed {
  0%,
  100% {
    background: #fffbeb;
  }

  50% {
    background: #fde68a;
  }
}

@keyframes diff-nav-flash-ack-error {
  0%,
  100% {
    background: #fef2f2;
  }

  50% {
    background: #fecaca;
  }
}

@keyframes diff-nav-flash-parse-error {
  0%,
  100% {
    background: #f5f3ff;
  }

  50% {
    background: #ddd6fe;
  }
}

.diff-nav__item--added {
  border-left-color: #10b981;
  --diff-nav-tag-bg: rgba(16, 185, 129, 0.12);
  --diff-nav-tag-fg: #047857;
}

.diff-nav__item--missing {
  border-left-color: #ef4444;
  --diff-nav-tag-bg: rgba(239, 68, 68, 0.12);
  --diff-nav-tag-fg: #b91c1c;
}

.diff-nav__item--changed {
  border-left-color: #f59e0b;
  --diff-nav-tag-bg: rgba(245, 158, 11, 0.14);
  --diff-nav-tag-fg: #b45309;
}

.diff-nav__item--field_changed {
  border-left-color: #f59e0b;
  --diff-nav-tag-bg: rgba(245, 158, 11, 0.14);
  --diff-nav-tag-fg: #b45309;
}

.diff-nav__item--ack_error {
  border-left-color: #dc2626;
  --diff-nav-tag-bg: rgba(220, 38, 38, 0.12);
  --diff-nav-tag-fg: #991b1b;
}

.diff-nav__item--parse_error {
  border-left-color: #8b5cf6;
  --diff-nav-tag-bg: rgba(139, 92, 246, 0.12);
  --diff-nav-tag-fg: #7c3aed;
}

.diff-nav__tag {
  border-radius: 4px;
  background: var(--diff-nav-tag-bg, #f1f5f9);
  padding: 2px 5px;
  color: var(--diff-nav-tag-fg, #475569);
  font-size: 11px;
  font-weight: 700;
  line-height: 16px;
}

.diff-nav__index {
  min-width: 22px;
  border-radius: 4px;
  background: #f1f5f9;
  padding: 2px 4px;
  color: #64748b;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 11px;
  font-weight: 700;
  line-height: 16px;
  text-align: center;
}

.diff-nav__title {
  min-width: 0;
  overflow: hidden;
  color: #334155;
  font-size: 12px;
  font-weight: 650;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.diff-nav__lines {
  grid-column: 1 / -1;
  color: #64748b;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 11px;
  line-height: 16px;
}

@media (max-width: 1100px) {
  .diff-nav {
    width: 100%;
    min-height: 220px;
    flex: 0 0 220px;
  }
}
</style>

<template>
  <div class="h-full flex flex-col gap-4">
    <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div class="flex items-center gap-2">
          <div class="p-2 bg-cyan-50 rounded-lg">
            <el-icon class="text-cyan-500 text-xl"><Grid /></el-icon>
          </div>
          <div>
            <h2 class="text-lg font-semibold text-slate-800 m-0">Slot 转换工具</h2>
            <p class="text-xs text-slate-500 m-0 mt-0.5">支持 25 槽位手动选择、map 图互转、反相 map 与区间表达式转换</p>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2 bg-slate-50 p-1.5 rounded-lg border border-slate-100">
          <el-button size="small" type="primary" class="!rounded-md shadow-sm" @click="selectAllSlots">全选</el-button>
          <el-button size="small" class="!rounded-md" @click="selectOddSlots">奇数槽</el-button>
          <el-button size="small" class="!rounded-md" @click="selectEvenSlots">偶数槽</el-button>
          <div class="w-px h-4 bg-slate-300 mx-1"></div>
          <el-button size="small" class="!rounded-md" @click="invertSelection">取反选择</el-button>
          <el-button size="small" type="danger" plain class="!rounded-md" @click="clearSlots">清空</el-button>
        </div>
      </div>
    </div>

    <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <div class="flex flex-col gap-3">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <div class="text-sm font-medium text-slate-700">SlotMap</div>
            <div class="text-xs text-slate-500 mt-1">第 1 个字符对应 Slot1，1 表示有 wafer，0 表示无 wafer。</div>
          </div>
          <div class="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <el-tag size="small" type="info">已选 {{ selectedCount }}/25</el-tag>
            <span>{{ humanReadableMap || '当前未选择任何槽位' }}</span>
          </div>
        </div>

        <div class="slot-scroll">
          <div class="slot-row">
            <button
              v-for="(selected, index) in selectedSlots"
              :key="index"
              type="button"
              class="slot-button"
              :class="selected ? 'slot-button--active' : 'slot-button--inactive'"
              :aria-pressed="selected"
              @click="toggleSlot(index)"
            >
              {{ index + 1 }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-3 gap-4 min-h-0">
      <div class="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
        <div class="bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center justify-between gap-2">
          <span class="text-sm font-medium text-slate-600">25 位 map</span>
          <div class="flex items-center gap-2">
            <el-button size="small" class="!rounded-md" @click="copyText(slotMapText, '25 位 map')">复制</el-button>
            <el-button size="small" type="primary" class="!rounded-md" @click="applySlotMapText">应用</el-button>
          </div>
        </div>
        <div class="p-4 flex flex-col gap-3">
          <el-input
            v-model="slotMapText"
            type="textarea"
            :rows="4"
            resize="none"
            class="map-textarea"
            placeholder="例如：0011000000000000000000000"
            @keyup.enter.ctrl="applySlotMapText"
          />
          <div class="text-xs text-slate-500">输入 25 位仅包含 0 和 1 的 map，点击“应用”即可反向恢复槽位状态。</div>
        </div>
      </div>

      <div class="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
        <div class="bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center justify-between gap-2">
          <span class="text-sm font-medium text-slate-600">25 位反相 map</span>
          <div class="flex items-center gap-2">
            <el-button size="small" class="!rounded-md" @click="copyText(invertedSlotMapText, '25 位反相 map')">复制</el-button>
            <el-button size="small" type="primary" class="!rounded-md" @click="applyInvertedSlotMapText">应用</el-button>
          </div>
        </div>
        <div class="p-4 flex flex-col gap-3">
          <el-input
            v-model="invertedSlotMapText"
            type="textarea"
            :rows="4"
            resize="none"
            class="map-textarea"
            placeholder="例如：1100111111111111111111111"
            @keyup.enter.ctrl="applyInvertedSlotMapText"
          />
          <div class="text-xs text-slate-500">该字段表示当前 25 位 map 的取反结果，输入后应用时会自动还原为真实槽位。</div>
        </div>
      </div>

      <div class="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
        <div class="bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center justify-between gap-2">
          <span class="text-sm font-medium text-slate-600">人类可读 map</span>
          <div class="flex items-center gap-2">
            <el-button size="small" class="!rounded-md" @click="copyText(humanReadableMapText, '区间 map')">复制</el-button>
            <el-button size="small" type="primary" class="!rounded-md" @click="applyHumanReadableMapText">应用</el-button>
          </div>
        </div>
        <div class="p-4 flex flex-col gap-3">
          <el-input
            v-model="humanReadableMapText"
            type="textarea"
            :rows="4"
            resize="none"
            class="map-textarea"
            placeholder="例如：1-5,8,10,17-25"
            @keyup.enter.ctrl="applyHumanReadableMapText"
          />
          <div class="text-xs text-slate-500">支持单点和区间混合输入，例如 1-3,5,7,10-12。留空后应用可直接清空全部槽位。</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Grid } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

const SLOT_COUNT = 25

type SlotSelection = boolean[]

const selectedSlots = ref<SlotSelection>(createEmptySelection())
const slotMapText = ref('')
const invertedSlotMapText = ref('')
const humanReadableMapText = ref('')

const selectedCount = computed(() => selectedSlots.value.filter(Boolean).length)
const humanReadableMap = computed(() => serializeSelectionToRanges(selectedSlots.value))

function createEmptySelection(): SlotSelection {
  return Array.from({ length: SLOT_COUNT }, () => false)
}

function cloneSelection(selection: SlotSelection): SlotSelection {
  return selection.slice()
}

function serializeSelectionToMap(selection: SlotSelection) {
  return selection.map(slot => (slot ? '1' : '0')).join('')
}

function invertBinaryMap(mapText: string) {
  return mapText
    .split('')
    .map(char => (char === '1' ? '0' : '1'))
    .join('')
}

function serializeSelectionToRanges(selection: SlotSelection) {
  const ranges: string[] = []
  let start = -1

  for (let index = 0; index < selection.length; index += 1) {
    const slotNumber = index + 1
    const isSelected = selection[index]

    if (isSelected && start === -1) {
      start = slotNumber
    }

    const isRangeEnd = start !== -1 && (!isSelected || index === selection.length - 1)
    if (!isRangeEnd) {
      continue
    }

    const end = isSelected && index === selection.length - 1 ? slotNumber : slotNumber - 1
    ranges.push(start === end ? `${start}` : `${start}-${end}`)
    start = -1
  }

  return ranges.join(',')
}

function normalizeMapInput(rawText: string) {
  return rawText.replace(/[\s，,]/g, '')
}

function parseMapText(rawText: string) {
  const normalized = normalizeMapInput(rawText)
  if (!/^[01]{25}$/.test(normalized)) {
    throw new Error('map 格式无效，请输入 25 位仅包含 0 和 1 的字符串')
  }

  return normalized.split('').map(char => char === '1')
}

function parseHumanReadableMap(rawText: string) {
  const normalized = rawText.replace(/，/g, ',').replace(/\s+/g, '')
  if (!normalized) {
    return createEmptySelection()
  }

  const selection = createEmptySelection()
  const parts = normalized.split(',').filter(Boolean)

  for (const part of parts) {
    if (/^\d+$/.test(part)) {
      const slotNumber = Number(part)
      assertSlotNumber(slotNumber)
      selection[slotNumber - 1] = true
      continue
    }

    const rangeMatch = part.match(/^(\d+)-(\d+)$/)
    if (!rangeMatch) {
      throw new Error('区间格式无效，请使用 1-5,8,10,17-25 这种形式')
    }

    const start = Number(rangeMatch[1])
    const end = Number(rangeMatch[2])
    assertSlotNumber(start)
    assertSlotNumber(end)

    if (start > end) {
      throw new Error('区间起始槽位不能大于结束槽位')
    }

    for (let slotNumber = start; slotNumber <= end; slotNumber += 1) {
      selection[slotNumber - 1] = true
    }
  }

  return selection
}

function assertSlotNumber(slotNumber: number) {
  if (!Number.isInteger(slotNumber) || slotNumber < 1 || slotNumber > SLOT_COUNT) {
    throw new Error(`槽位编号必须位于 1 到 ${SLOT_COUNT} 之间`)
  }
}

function syncTextsFromSelection() {
  const mapText = serializeSelectionToMap(selectedSlots.value)
  slotMapText.value = mapText
  invertedSlotMapText.value = invertBinaryMap(mapText)
  humanReadableMapText.value = serializeSelectionToRanges(selectedSlots.value)
}

function applySelection(selection: SlotSelection, successMessage?: string) {
  selectedSlots.value = cloneSelection(selection)
  syncTextsFromSelection()
  if (successMessage) {
    ElMessage.success(successMessage)
  }
}

function toggleSlot(index: number) {
  const nextSelection = cloneSelection(selectedSlots.value)
  nextSelection[index] = !nextSelection[index]
  applySelection(nextSelection)
}

function selectAllSlots() {
  applySelection(Array.from({ length: SLOT_COUNT }, () => true), '已全选 25 个槽位')
}

function selectOddSlots() {
  applySelection(Array.from({ length: SLOT_COUNT }, (_, index) => (index + 1) % 2 === 1), '已选中全部奇数槽')
}

function selectEvenSlots() {
  applySelection(Array.from({ length: SLOT_COUNT }, (_, index) => (index + 1) % 2 === 0), '已选中全部偶数槽')
}

function invertSelection() {
  applySelection(selectedSlots.value.map(slot => !slot), '已完成槽位取反')
}

function clearSlots() {
  applySelection(createEmptySelection(), '已清空所有槽位')
}

function applySlotMapText() {
  try {
    applySelection(parseMapText(slotMapText.value), '已从 25 位 map 还原槽位')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '25 位 map 解析失败')
  }
}

function applyInvertedSlotMapText() {
  try {
    const invertedSelection = parseMapText(invertedSlotMapText.value).map(slot => !slot)
    applySelection(invertedSelection, '已从 25 位反相 map 还原槽位')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '25 位反相 map 解析失败')
  }
}

function applyHumanReadableMapText() {
  try {
    applySelection(parseHumanReadableMap(humanReadableMapText.value), '已从区间 map 还原槽位')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '区间 map 解析失败')
  }
}

async function copyText(text: string, label: string) {
  if (!text) {
    ElMessage.warning(`暂无可复制的${label}`)
    return
  }

  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success(`已复制${label}`)
  } catch {
    ElMessage.error(`复制${label}失败，请手动复制`)
  }
}

onMounted(() => {
  syncTextsFromSelection()
})
</script>

<style scoped>
.slot-scroll {
  overflow-x: auto;
  padding-bottom: 0.25rem;
}

.slot-row {
  display: inline-flex;
  gap: 0.5rem;
  min-width: max-content;
}

.slot-button {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 0.625rem;
  border: 1px solid #cbd5e1;
  font-size: 0.875rem;
  line-height: 1;
  transition: all 0.2s ease;
}

.slot-button--inactive {
  background: #ffffff;
  color: #64748b;
}

.slot-button--inactive:hover {
  border-color: #22d3ee;
  color: #0f766e;
  background: #ecfeff;
}

.slot-button--active {
  background: linear-gradient(135deg, #06b6d4, #0891b2);
  border-color: #0891b2;
  color: #ffffff;
  box-shadow: 0 8px 18px rgba(8, 145, 178, 0.18);
}

.slot-button--active:hover {
  filter: brightness(1.03);
}

.map-textarea :deep(.el-textarea__inner) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  line-height: 1.6;
}
</style>

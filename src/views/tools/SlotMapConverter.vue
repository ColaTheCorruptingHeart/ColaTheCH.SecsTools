<template>
  <div class="slot-map-page">
    <section class="slot-map-card" aria-labelledby="slot-map-title">
      <div class="slot-map-card__top">
        <div>
          <h2 id="slot-map-title">SlotMap</h2>
          <p>第 1 个值对应 Slot1，所有格式使用相同的有片与空槽映射。</p>
        </div>

        <div class="mapping-fields" aria-label="槽位数字映射">
          <span class="mapping-fields__label">数字映射</span>
          <label>
            <span>有片</span>
            <input
              :value="slotValueMapping.occupiedDigit"
              inputmode="numeric"
              maxlength="1"
              aria-label="有片映射值"
              data-testid="occupied-digit"
              @input="updateMappingDigit('occupiedDigit', $event)"
            />
          </label>
          <label>
            <span>空槽</span>
            <input
              :value="slotValueMapping.emptyDigit"
              inputmode="numeric"
              maxlength="1"
              aria-label="空槽映射值"
              data-testid="empty-digit"
              @input="updateMappingDigit('emptyDigit', $event)"
            />
          </label>
        </div>
      </div>

      <div class="slot-map-card__actions">
        <div class="slot-summary">
          <el-tag size="small" type="info">已选 {{ selectedCount }}/{{ SLOT_COUNT }}</el-tag>
          <span>{{ humanReadableMap || '当前未选择任何槽位' }}</span>
        </div>
        <div class="action-buttons">
          <el-button size="small" type="primary" @click="selectAllSlots">全选</el-button>
          <el-button size="small" @click="selectOddSlots">奇数槽</el-button>
          <el-button size="small" @click="selectEvenSlots">偶数槽</el-button>
          <el-button size="small" @click="invertSelection">取反选择</el-button>
          <el-button size="small" type="danger" plain @click="clearSlots">清空</el-button>
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
            :aria-label="`Slot ${index + 1}`"
            @click="toggleSlot(index)"
          >
            {{ index + 1 }}
          </button>
        </div>
      </div>
    </section>

    <section class="outputs-grid" aria-label="SlotMap 转换结果">
      <div class="compact-stack">
        <article class="output-card compact-card">
          <header>
            <span>25 位 map</span>
            <div>
              <el-button size="small" @click="copyText(slotMapText, '25 位 map')">复制</el-button>
              <el-button size="small" type="primary" @click="applySlotMapText">应用</el-button>
            </div>
          </header>
          <div class="output-card__body">
            <el-input
              v-model="slotMapText"
              type="textarea"
              :rows="3"
              resize="none"
              class="map-textarea"
              data-testid="slot-map"
              :placeholder="`输入 ${SLOT_COUNT} 位，仅使用 ${slotValueMapping.occupiedDigit} 和 ${slotValueMapping.emptyDigit}`"
              @keyup.enter.ctrl="applySlotMapText"
            />
          </div>
        </article>

        <article class="output-card compact-card">
          <header>
            <span>25 位反相 map</span>
            <div>
              <el-button size="small" @click="copyText(invertedSlotMapText, '25 位反相 map')">复制</el-button>
              <el-button size="small" type="primary" @click="applyInvertedSlotMapText">应用</el-button>
            </div>
          </header>
          <div class="output-card__body">
            <el-input
              v-model="invertedSlotMapText"
              type="textarea"
              :rows="3"
              resize="none"
              class="map-textarea"
              data-testid="inverted-slot-map"
              :placeholder="`输入 ${SLOT_COUNT} 位反相 map`"
              @keyup.enter.ctrl="applyInvertedSlotMapText"
            />
          </div>
        </article>

        <article class="output-card compact-card">
          <header>
            <span>人类可读 map</span>
            <div>
              <el-button size="small" @click="copyText(humanReadableMapText, '区间 map')">复制</el-button>
              <el-button size="small" type="primary" @click="applyHumanReadableMapText">应用</el-button>
            </div>
          </header>
          <div class="output-card__body">
            <el-input
              v-model="humanReadableMapText"
              type="textarea"
              :rows="3"
              resize="none"
              class="map-textarea"
              placeholder="例如：1-5,8,10,17-25"
              @keyup.enter.ctrl="applyHumanReadableMapText"
            />
          </div>
        </article>
      </div>

      <article class="output-card list-card">
        <header>
          <div>
            <span>纵向 U1 List</span>
          </div>
          <div>
            <el-button size="small" @click="copyText(verticalListText, '纵向 U1 List')">复制</el-button>
            <el-button size="small" type="primary" @click="applyVerticalListText(false)">应用 List</el-button>
          </div>
        </header>
        <div class="output-card__body list-card__body">
          <el-input
            v-model="verticalListText"
            type="textarea"
            resize="none"
            class="map-textarea list-textarea"
            data-testid="vertical-list"
            @keyup.enter.ctrl="applyVerticalListText(false)"
          />
        </div>
      </article>

      <article class="output-card list-card">
        <header>
          <div>
            <span>纵向 U1 List · 反相</span>
          </div>
          <div>
            <el-button size="small" @click="copyText(invertedVerticalListText, '纵向 U1 List 反相')">复制</el-button>
            <el-button size="small" type="primary" @click="applyVerticalListText(true)">应用反相 List</el-button>
          </div>
        </header>
        <div class="output-card__body list-card__body">
          <el-input
            v-model="invertedVerticalListText"
            type="textarea"
            resize="none"
            class="map-textarea list-textarea"
            data-testid="inverted-vertical-list"
            @keyup.enter.ctrl="applyVerticalListText(true)"
          />
        </div>
      </article>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  DEFAULT_SLOT_VALUE_MAPPING,
  parseMappedMapText,
  parseSlotSmlList,
  serializeSelectionToMappedMap,
  serializeSelectionToSmlList,
  SLOT_COUNT,
  type SlotValueMapping
} from './slotMap'

type SlotSelection = boolean[]

const selectedSlots = ref<SlotSelection>(createEmptySelection())
const slotMapText = ref('')
const invertedSlotMapText = ref('')
const humanReadableMapText = ref('')
const verticalListText = ref('')
const invertedVerticalListText = ref('')
const slotValueMapping = ref<SlotValueMapping>({ ...DEFAULT_SLOT_VALUE_MAPPING })

const selectedCount = computed(() => selectedSlots.value.filter(Boolean).length)
const humanReadableMap = computed(() => serializeSelectionToRanges(selectedSlots.value))

function createEmptySelection(): SlotSelection {
  return Array.from({ length: SLOT_COUNT }, () => false)
}

function cloneSelection(selection: SlotSelection): SlotSelection {
  return selection.slice()
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
    if (!isRangeEnd) continue

    const end = isSelected && index === selection.length - 1 ? slotNumber : slotNumber - 1
    ranges.push(start === end ? `${start}` : `${start}-${end}`)
    start = -1
  }

  return ranges.join(',')
}

function parseHumanReadableMap(rawText: string) {
  const normalized = rawText.replace(/，/g, ',').replace(/\s+/g, '')
  if (!normalized) return createEmptySelection()

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

    if (start > end) throw new Error('区间起始槽位不能大于结束槽位')
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
  slotMapText.value = serializeSelectionToMappedMap(selectedSlots.value, slotValueMapping.value)
  invertedSlotMapText.value = serializeSelectionToMappedMap(selectedSlots.value, slotValueMapping.value, true)
  humanReadableMapText.value = serializeSelectionToRanges(selectedSlots.value)
  verticalListText.value = serializeSelectionToSmlList(selectedSlots.value, slotValueMapping.value)
  invertedVerticalListText.value = serializeSelectionToSmlList(selectedSlots.value, slotValueMapping.value, true)
}

function updateMappingDigit(key: keyof SlotValueMapping, event: Event) {
  const input = event.target as HTMLInputElement
  const currentValue = slotValueMapping.value[key]
  const nextValue = input.value.replace(/\D/g, '').slice(-1)
  const otherKey: keyof SlotValueMapping = key === 'occupiedDigit' ? 'emptyDigit' : 'occupiedDigit'

  if (!nextValue) {
    input.value = currentValue
    ElMessage.warning('映射值只能使用 0 到 9 的单个数字')
    return
  }

  if (nextValue === slotValueMapping.value[otherKey]) {
    input.value = currentValue
    ElMessage.warning('有片值和空槽值不能相同')
    return
  }

  slotValueMapping.value = { ...slotValueMapping.value, [key]: nextValue }
  syncTextsFromSelection()
}

function applySelection(selection: SlotSelection, successMessage?: string) {
  selectedSlots.value = cloneSelection(selection)
  syncTextsFromSelection()
  if (successMessage) ElMessage.success(successMessage)
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
    applySelection(parseMappedMapText(slotMapText.value, slotValueMapping.value), '已从 25 位 map 还原槽位')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '25 位 map 解析失败')
  }
}

function applyInvertedSlotMapText() {
  try {
    applySelection(
      parseMappedMapText(invertedSlotMapText.value, slotValueMapping.value, true),
      '已从 25 位反相 map 还原槽位'
    )
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

function applyVerticalListText(inverted: boolean) {
  const inputText = inverted ? invertedVerticalListText.value : verticalListText.value
  try {
    const result = parseSlotSmlList(inputText, slotValueMapping.value, inverted)
    applySelection(result.selection, inverted ? '已从反相 List 还原槽位' : '已从纵向 List 还原槽位')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '纵向 List 解析失败')
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

onMounted(syncTextsFromSelection)
</script>

<style scoped>
.slot-map-page {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-bottom: 4px;
}

.slot-map-card,
.output-card {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #ffffff;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

.slot-map-card {
  padding: 14px 16px 16px;
}

.slot-map-card__top,
.slot-map-card__actions,
.action-buttons,
.mapping-fields,
.mapping-fields label,
.slot-summary {
  display: flex;
  align-items: center;
}

.slot-map-card__top,
.slot-map-card__actions {
  justify-content: space-between;
  gap: 16px;
}

.slot-map-card h2 {
  margin: 0;
  color: #1e293b;
  font-size: 15px;
  font-weight: 600;
}

.slot-map-card p {
  margin: 3px 0 0;
  color: #64748b;
  font-size: 12px;
}

.mapping-fields {
  gap: 12px;
  color: #475569;
  font-size: 12px;
}

.mapping-fields__label {
  color: #64748b;
}

.mapping-fields label {
  gap: 6px;
  white-space: nowrap;
}

.mapping-fields input {
  width: 32px;
  height: 28px;
  padding: 0;
  border: 1px solid #cbd5e1;
  border-radius: 5px;
  outline: none;
  color: #0f172a;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-weight: 600;
  text-align: center;
}

.mapping-fields input:focus-visible {
  border-color: #0891b2;
  box-shadow: 0 0 0 2px rgba(8, 145, 178, 0.12);
}

.slot-map-card__actions {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid #f1f5f9;
}

.slot-summary,
.action-buttons {
  gap: 8px;
}

.slot-summary {
  min-width: 0;
  color: #64748b;
  font-size: 12px;
}

.slot-summary span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.slot-scroll {
  margin-top: 12px;
  overflow-x: auto;
  padding-bottom: 2px;
}

.slot-row {
  display: inline-flex;
  min-width: max-content;
  gap: 7px;
}

.slot-button {
  width: 38px;
  height: 36px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 13px;
  line-height: 1;
  transition: border-color 0.15s ease, background-color 0.15s ease, color 0.15s ease;
}

.slot-button--inactive {
  background: #ffffff;
  color: #64748b;
}

.slot-button--inactive:hover {
  border-color: #0891b2;
  color: #0e7490;
}

.slot-button--active {
  border-color: #0891b2;
  background: #0891b2;
  color: #ffffff;
}

.outputs-grid {
  min-height: 610px;
  display: grid;
  grid-template-columns: minmax(0, 4fr) minmax(0, 3fr) minmax(0, 3fr);
  gap: 12px;
}

.compact-stack {
  display: grid;
  grid-template-rows: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.output-card {
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.output-card header {
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 7px 10px 7px 12px;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
  color: #475569;
  font-size: 13px;
  font-weight: 600;
}

.output-card header > div {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.output-card header small {
  color: #94a3b8;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 10px;
  font-weight: 400;
  white-space: nowrap;
}

.output-card__body {
  min-height: 0;
  flex: 1;
  padding: 10px;
}

.compact-card .output-card__body {
  display: flex;
}

.map-textarea {
  width: 100%;
}

.map-textarea :deep(.el-textarea__inner) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 12px;
  line-height: 1.55;
}

.list-card__body {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.list-textarea {
  min-height: 0;
  flex: 1;
}

.list-textarea :deep(.el-textarea__inner) {
  height: 100%;
  min-height: 0 !important;
}

.list-card__body p {
  margin: 0;
  color: #94a3b8;
  font-size: 11px;
  line-height: 16px;
}

@media (max-width: 1279px) {
  .outputs-grid {
    min-height: 0;
    grid-template-columns: 1fr;
  }

  .compact-stack {
    grid-template-rows: none;
  }

  .list-card {
    min-height: 560px;
  }
}

@media (max-width: 767px) {
  .slot-map-card__top,
  .slot-map-card__actions {
    align-items: flex-start;
    flex-direction: column;
  }

  .mapping-fields,
  .action-buttons {
    flex-wrap: wrap;
  }

  .slot-summary {
    width: 100%;
  }

  .output-card header {
    align-items: flex-start;
    flex-direction: column;
  }
}

@media (prefers-reduced-motion: reduce) {
  .slot-button {
    transition: none;
  }
}
</style>

<template>
  <el-dialog
    v-model="visibleModel"
    title="导出标记区间"
    width="min(520px, calc(100vw - 32px))"
    destroy-on-close
  >
    <el-form label-position="top" class="range-export-form" @submit.prevent="confirmExport">
      <el-form-item label="机台号">
        <el-select
          v-model="machineId"
          class="w-full"
          clearable
          filterable
          allow-create
          default-first-option
          placeholder="可选，可输入新机台号"
        >
          <el-option v-for="option in machineOptions" :key="option" :label="option" :value="option" />
        </el-select>
      </el-form-item>

      <el-form-item label="批次号">
        <el-input v-model="batchId" clearable :placeholder="`可选，留空时使用 ${lineRange}`" />
      </el-form-item>

      <div class="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
        <el-form-item label="日志日期">
          <el-input :model-value="logDate" readonly />
        </el-form-item>

        <el-form-item label="内容哈希">
          <el-input :model-value="contentHash" readonly />
        </el-form-item>
      </div>

      <el-form-item label="导出文件名" class="mb-0!">
        <div
          class="w-full overflow-hidden rounded border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs leading-5 text-slate-700 dark:border-slate-600 dark:bg-slate-900/60 dark:text-slate-200"
          :title="fileNamePreview"
        >
          <span class="block truncate">{{ fileNamePreview }}</span>
        </div>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="visibleModel = false">取消</el-button>
      <el-button type="primary" @click="confirmExport">导出日志</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { buildRangeExportFileName } from '../rangeExport'

const props = defineProps<{
  modelValue: boolean
  machineOptions: string[]
  initialMachineId: string
  startLine: number
  endLine: number
  logDate: string
  contentHash: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: [value: { machineId: string, batchId: string }]
}>()

const machineId = ref('')
const batchId = ref('')

const visibleModel = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value)
})

const lineRange = computed(() => `L${props.startLine}-L${props.endLine}`)
const fileNamePreview = computed(() => buildRangeExportFileName({
  machineId: machineId.value,
  batchId: batchId.value,
  startLine: props.startLine,
  endLine: props.endLine,
  logDate: props.logDate,
  contentHash: props.contentHash
}))

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) {
      machineId.value = props.initialMachineId
      batchId.value = ''
    }
  }
)

const confirmExport = () => {
  emit('confirm', {
    machineId: machineId.value.trim(),
    batchId: batchId.value.trim()
  })
}
</script>

<style scoped>
.range-export-form :deep(.el-form-item__label) {
  color: #475569;
  font-size: 13px;
  line-height: 20px;
  margin-bottom: 5px;
}
</style>

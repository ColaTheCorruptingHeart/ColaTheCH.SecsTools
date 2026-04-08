<template>
  <el-dialog v-model="visibleModel" title="导入 CEID 匹配规则" width="500px">
    <div class="mb-2 text-sm text-slate-500">
      请输入或粘贴 CEID 对应规则，格式为 每行：<code>CEID=描述</code>
    </div>
    <el-input
      v-model="textModel"
      type="textarea"
      :rows="8"
      placeholder="例如：&#10;2300=MappingEnd&#10;700=PrJobCreated"
    />
    <template #footer>
      <span class="dialog-footer">
        <el-button @click="visibleModel = false">取消</el-button>
        <el-button type="primary" @click="emit('confirm')">确定导入</el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  modelValue: boolean
  importText: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'update:importText': [value: string]
  confirm: []
}>()

const visibleModel = computed({
  get: () => props.modelValue,
  set: (value: boolean) => {
    emit('update:modelValue', value)
  }
})

const textModel = computed({
  get: () => props.importText,
  set: (value: string) => {
    emit('update:importText', value)
  }
})
</script>

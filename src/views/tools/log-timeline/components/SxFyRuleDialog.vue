<template>
  <el-dialog v-model="visibleModel" :title="isEdit ? '编辑 SxFy 规则' : '添加 SxFy 规则'" width="450px" destroy-on-close>
    <el-form :model="localForm" label-width="110px" size="default">
      <el-form-item label="Stream (S)">
        <el-input-number v-model="localForm.s" :min="1" :max="99" />
      </el-form-item>
      <el-form-item label="Function (F)">
        <el-input-number v-model="localForm.f" :min="0" :max="99" />
      </el-form-item>
      <el-form-item label="关键值位置">
        <el-input v-model="localForm.keyPos" placeholder="可选，如 [0][1]" />
      </el-form-item>
      <el-form-item label="自定义描述">
        <el-input v-model="localForm.desc" placeholder="为空时自动生成" />
      </el-form-item>
      <el-form-item label="标记颜色">
        <el-color-picker v-model="localForm.color" :predefine="predefineColors" />
      </el-form-item>
    </el-form>
    <template #footer>
      <span class="dialog-footer">
        <el-button @click="visibleModel = false">取消</el-button>
        <el-button type="primary" @click="emit('save', { ...localForm })">确定</el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { SxFyRuleItem } from '../types'

const props = defineProps<{
  modelValue: boolean
  isEdit: boolean
  form: SxFyRuleItem
  predefineColors: string[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  save: [value: SxFyRuleItem]
}>()

const localForm = ref<SxFyRuleItem>({ ...props.form })

watch(
  () => [props.modelValue, props.form] as const,
  () => {
    localForm.value = { ...props.form }
  },
  { deep: true, immediate: true }
)

const visibleModel = computed({
  get: () => props.modelValue,
  set: (value: boolean) => {
    emit('update:modelValue', value)
  }
})
</script>

<template>
  <el-dialog v-model="visibleModel" title="自定义 CEID 匹配" width="430px" destroy-on-close>
    <el-form :model="localForm" label-width="110px">
      <el-form-item label="Stream (S)"><el-input-number v-model="localForm.s" :min="1" :max="99" /></el-form-item>
      <el-form-item label="Function (F)"><el-input-number v-model="localForm.f" :min="0" :max="99" /></el-form-item>
      <el-form-item label="关键值位置"><el-input v-model="localForm.keyPos" placeholder="如 [0][1]" /></el-form-item>
    </el-form>
    <template #footer><el-button @click="visibleModel = false">取消</el-button><el-button type="primary" @click="emit('save', { ...localForm })">确定</el-button></template>
  </el-dialog>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { CeidMatchRule } from '../types'
const props = defineProps<{ modelValue: boolean; form: CeidMatchRule }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; save: [value: CeidMatchRule] }>()
const localForm = ref<CeidMatchRule>({ ...props.form })
watch(() => [props.modelValue, props.form] as const, () => { localForm.value = { ...props.form } }, { deep: true, immediate: true })
const visibleModel = computed({ get: () => props.modelValue, set: (value: boolean) => emit('update:modelValue', value) })
</script>

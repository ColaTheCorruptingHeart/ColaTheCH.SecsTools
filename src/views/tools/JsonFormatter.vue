<template>
  <div class="h-full flex flex-col gap-4">
    <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div class="flex items-center gap-2">
          <div class="p-2 bg-emerald-50 rounded-lg">
            <el-icon class="text-emerald-500 text-xl"><ScaleToOriginal /></el-icon>
          </div>
          <div>
            <h2 class="text-lg font-semibold text-slate-800 m-0">JSON 格式化工具</h2>
            <p class="text-xs text-slate-500 m-0 mt-0.5">格式化、校验并压缩 JSON 数据</p>
          </div>
        </div>

        <div class="flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border border-slate-100">
          <el-button size="small" type="primary" class="!rounded-md shadow-sm" @click="formatJson">格式化 (2空格)</el-button>
          <el-button size="small" class="!rounded-md" @click="formatJson4">格式化 (4空格)</el-button>
          <el-button size="small" class="!rounded-md" @click="compressJson">压缩</el-button>
          <div class="w-px h-4 bg-slate-300 mx-1"></div>
          <el-button size="small" type="danger" plain class="!rounded-md" @click="clear">清空</el-button>
        </div>
      </div>
    </div>

    <div class="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
      <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div class="bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center justify-between">
          <span class="text-sm font-medium text-slate-600">原数据输入</span>
        </div>
        <el-input
          v-model="sourceJson"
          type="textarea"
          :rows="24"
          placeholder="在此输入或粘贴 JSON 数据..."
          class="code-input flex-1 !border-0"
          resize="none"
        />
      </div>

      <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div class="bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center justify-between">
          <span class="text-sm font-medium text-slate-600">处理结果</span>
        </div>
        <el-input
          v-model="resultJson"
          type="textarea"
          :rows="24"
          placeholder="结果将在此显示..."
          readonly
          class="code-input flex-1 !border-0 bg-slate-50/30"
          resize="none"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ScaleToOriginal } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

const sourceJson = ref('')
const resultJson = ref('')

const validateJson = () => {
  if (!sourceJson.value.trim()) {
    ElMessage.warning('请输入 JSON 数据')
    return null
  }
  try {
    return JSON.parse(sourceJson.value)
  } catch (error: unknown) {
    if (error instanceof Error) {
      resultJson.value = `JSON 解析错误:\n${error.message}`
    } else {
      resultJson.value = 'JSON 解析错误: 未知错误'
    }
    ElMessage.error('非法的 JSON 格式')
    return null
  }
}

const formatJson = () => {
  const obj = validateJson()
  if (obj) {
    resultJson.value = JSON.stringify(obj, null, 2)
    ElMessage.success('格式化完成')
  }
}

const formatJson4 = () => {
  const obj = validateJson()
  if (obj) {
    resultJson.value = JSON.stringify(obj, null, 4)
    ElMessage.success('格式化完成')
  }
}

const compressJson = () => {
  const obj = validateJson()
  if (obj) {
    resultJson.value = JSON.stringify(obj)
    ElMessage.success('压缩完成')
  }
}

const clear = () => {
  sourceJson.value = ''
  resultJson.value = ''
}
</script>

<style scoped>
.code-input :deep(.el-textarea__inner) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  height: 100% !important;
  border: none !important;
  box-shadow: none !important;
  padding: 1rem;
  font-size: 14px;
  line-height: 1.6;
  background-color: transparent !important;
}
.code-input :deep(.el-textarea__inner:focus) {
  box-shadow: none !important;
}
</style>

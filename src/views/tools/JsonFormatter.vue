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

    <div class="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 h-0 min-h-[500px]">
      <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
        <div class="bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center justify-between shrink-0">
          <span class="text-sm font-medium text-slate-600">原数据输入</span>
        </div>
        <el-input
          v-model="sourceJson"
          type="textarea"
          placeholder="在此输入或粘贴 JSON 数据..."
          class="code-input flex-1 !border-0 flex"
          resize="none"
        />
      </div>

      <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
        <div class="bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center justify-between shrink-0">
          <span class="text-sm font-medium text-slate-600">处理结果</span>
          <div class="flex items-center gap-2">
            <el-button
              v-if="resultJson && !hasError"
              size="small"
              plain
              @click="copyResult"
              title="一键复制格式化后的代码"
            >
              <el-icon class="mr-1"><DocumentCopy /></el-icon> 复制
            </el-button>
            <div class="flex items-center gap-2" v-if="isValidObj && !isCompressed">
              <span class="text-xs text-slate-500">展开层级:</span>
              <el-select v-model="deep" size="small" style="width: 80px" @change="handleDeepChange">
                <el-option label="1层" :value="1" />
                <el-option label="2层" :value="2" />
                <el-option label="3层" :value="3" />
                <el-option label="4层" :value="4" />
                <el-option label="全部" :value="999" />
              </el-select>
            </div>
          </div>
        </div>
        <div class="flex-1 bg-slate-50/30 overflow-auto p-4 custom-scrollbar">
          <template v-if="hasError">
            <div class="text-red-500 font-mono whitespace-pre-wrap text-sm">{{ errorMsg }}</div>
          </template>
          <template v-else-if="resultObj !== null && !isCompressed">
            <vue-json-pretty
              :data="resultObj"
              :deep="deep"
              show-length
              show-icon
              show-line
              class="text-sm font-mono"
            />
          </template>
          <template v-else-if="resultJson">
            <div class="font-mono text-sm whitespace-pre-wrap break-all">{{ resultJson }}</div>
          </template>
          <template v-else>
            <div class="text-slate-400 text-sm">结果将在此显示...</div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ScaleToOriginal, DocumentCopy } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import VueJsonPretty from 'vue-json-pretty'
import 'vue-json-pretty/lib/styles.css'

const sourceJson = ref('')
const resultJson = ref('')
const resultObj = ref<any>(null)
const errorMsg = ref('')
const isCompressed = ref(false)
const deep = ref(999)

const hasError = computed(() => !!errorMsg.value)
const isValidObj = computed(() => resultObj.value !== null)

const validateJson = () => {
  errorMsg.value = ''
  if (!sourceJson.value.trim()) {
    ElMessage.warning('请输入 JSON 数据')
    return null
  }
  try {
    const obj = JSON.parse(sourceJson.value)
    resultObj.value = obj
    return obj
  } catch (error: unknown) {
    if (error instanceof Error) {
      errorMsg.value = `JSON 解析错误:\n${error.message}`
    } else {
      errorMsg.value = 'JSON 解析错误: 未知错误'
    }
    resultObj.value = null
    ElMessage.error('非法的 JSON 格式')
    return null
  }
}

const formatJson = () => {
  isCompressed.value = false
  const obj = validateJson()
  if (obj) {
    resultJson.value = JSON.stringify(obj, null, 2)
    ElMessage.success('格式化完成')
  }
}

const formatJson4 = () => {
  isCompressed.value = false
  const obj = validateJson()
  if (obj) {
    resultJson.value = JSON.stringify(obj, null, 4)
    ElMessage.success('格式化完成')
  }
}

const compressJson = () => {
  isCompressed.value = true
  const obj = validateJson()
  if (obj) {
    resultJson.value = JSON.stringify(obj)
    ElMessage.success('压缩完成')
  }
}

const copyResult = async () => {
  if (!resultJson.value) return
  try {
    await navigator.clipboard.writeText(resultJson.value)
    ElMessage.success('已复制到剪贴板')
  } catch (err) {
    ElMessage.error('复制失败，请尝试手动复制')
  }
}

const handleDeepChange = () => {
  // 触发重新渲染
}

const clear = () => {
  sourceJson.value = ''
  resultJson.value = ''
  resultObj.value = null
  errorMsg.value = ''
  isCompressed.value = false
}
</script>

<style scoped>
.code-input :deep(.el-textarea) {
  height: 100%;
}
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

.custom-scrollbar::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: rgba(148, 163, 184, 0.4);
  border-radius: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background-color: rgba(148, 163, 184, 0.6);
}
</style>

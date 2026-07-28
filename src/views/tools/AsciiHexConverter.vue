<template>
  <div class="h-full flex flex-col gap-4">
    <!-- Header Controls -->
    <div class="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 flex-none">
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div class="flex items-center gap-2">
          <div class="p-2 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
            <el-icon class="text-purple-500 text-xl"><Switch /></el-icon>
          </div>
          <div>
            <h2 class="text-lg font-semibold text-slate-800 dark:text-gray-100 m-0">ASCII / 十六进制 转换</h2>
            <p class="text-xs text-slate-500 dark:text-gray-400 m-0 mt-0.5">支持大块文本和 Hex 数据的互相转换</p>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2 bg-slate-50 dark:bg-slate-900/50 p-1.5 rounded-lg border border-slate-100 dark:border-slate-700">
          <el-button size="small" type="primary" class="!rounded-md shadow-sm" @click="handleTextToHex">
            文本 ➔ Hex
          </el-button>
          <el-button size="small" type="success" class="!rounded-md shadow-sm" @click="handleHexToText">
            Hex ➔ 文本
          </el-button>
          <div class="w-px h-4 bg-slate-300 dark:bg-slate-600 mx-1"></div>
          <el-button size="small" type="danger" plain class="!rounded-md" @click="clearAll">清空</el-button>
        </div>
      </div>
      
      <!-- Options -->
      <div class="mt-4 flex flex-wrap items-center gap-4 text-sm text-slate-600 dark:text-slate-300">
        <div class="flex items-center gap-2">
          <span>分隔符:</span>
          <el-select v-model="separator" size="small" style="width: 100px;">
            <el-option label="空格" value=" " />
            <el-option label="无" value="" />
            <el-option label="逗号" value="," />
            <el-option label="换行" value="\n" />
          </el-select>
        </div>
        <div class="flex items-center gap-2">
          <span>Hex 前缀:</span>
          <el-select v-model="prefix" size="small" style="width: 100px;">
            <el-option label="无" value="" />
            <el-option label="0x" value="0x" />
            <el-option label="\x" value="\x" />
            <el-option label="%" value="%" />
          </el-select>
        </div>
        <div class="flex items-center gap-2">
          <span>大写字母:</span>
          <el-switch v-model="uppercase" size="small" />
        </div>
        <div class="flex items-center gap-2">
          <span>编码:</span>
          <el-select v-model="encoding" size="small" style="width: 100px;">
            <el-option label="UTF-8" value="utf-8" />
            <el-option label="GBK" value="gbk" />
          </el-select>
        </div>
      </div>
    </div>

    <!-- Main Content Grid -->
    <div class="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 min-h-0">
      <!-- Input Panel -->
      <div class="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col h-full overflow-hidden">
        <div class="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 px-4 py-2 flex items-center justify-between shrink-0">
          <span class="text-sm font-medium text-slate-600 dark:text-slate-300">输入区</span>
        </div>
        <el-input
          v-model="sourceText"
          type="textarea"
          placeholder="在此输入需要转换的文本或 Hex 数据..."
          class="flex-1 !border-0 flex custom-textarea h-full"
          :input-style="{ height: '100%', resize: 'none', border: 'none', boxShadow: 'none' }"
        />
      </div>

      <!-- Output Panel -->
      <div class="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col h-full overflow-hidden">
        <div class="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 px-4 py-2 flex items-center justify-between shrink-0">
          <span class="text-sm font-medium text-slate-600 dark:text-slate-300">处理结果</span>
          <el-button size="small" plain @click="copyResult" title="一键复制结果" :disabled="!resultText">
            <el-icon class="mr-1"><DocumentCopy /></el-icon> 复制结果
          </el-button>
        </div>
        <el-input
          v-model="resultText"
          type="textarea"
          placeholder="转换结果将在此显示..."
          readonly
          class="flex-1 !border-0 flex custom-textarea h-full"
          :input-style="{ height: '100%', resize: 'none', border: 'none', boxShadow: 'none', backgroundColor: 'transparent' }"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Switch, DocumentCopy } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

const sourceText = ref('')
const resultText = ref('')

const separator = ref(' ')
const prefix = ref('')
const uppercase = ref(true)
const encoding = ref('utf-8')

const clearAll = () => {
  sourceText.value = ''
  resultText.value = ''
}

const copyResult = async () => {
  if (!resultText.value) return
  try {
    await navigator.clipboard.writeText(resultText.value)
    ElMessage.success('已复制到剪贴板')
  } catch (err) {
    ElMessage.error('复制失败，请手动选择复制')
  }
}

const handleTextToHex = async () => {
  if (!sourceText.value) {
    resultText.value = ''
    return
  }
  
  try {
    let bytes: Uint8Array
    if (encoding.value === 'gbk') {
      // 浏览器环境目前没有原生 TextEncoder 支持 GBK
      // 简单使用 utf-8，或需要引入特定库
      bytes = new TextEncoder().encode(sourceText.value)
      if (encoding.value === 'gbk') {
         ElMessage.info('暂仅支持通过原生 API 编码为 UTF-8，当前按 UTF-8 编码处理')
      }
    } else {
      bytes = new TextEncoder().encode(sourceText.value)
    }

    let hexArray = Array.from(bytes).map(byte => {
      let hex = byte.toString(16).padStart(2, '0')
      if (uppercase.value) hex = hex.toUpperCase()
      return prefix.value + hex
    })
    
    resultText.value = hexArray.join(separator.value)
  } catch (e: any) {
    ElMessage.error('转换失败: ' + e.message)
  }
}

const handleHexToText = async () => {
  if (!sourceText.value) {
    resultText.value = ''
    return
  }
  
  try {
    // 提取所有的十六进制字符（过滤掉无关字符如空格、0x、\x、逗号等）
    // 匹配连续的两位16进制
    const cleanStr = sourceText.value.replace(/0x|\\x|%/ig, ' ').replace(/[^a-fA-F0-9]/g, '')
    if (cleanStr.length % 2 !== 0) {
      ElMessage.warning('警告：有效的十六进制字符数为奇数，部分数据可能丢失或末尾被忽略。')
    }
    
    const bytes = new Uint8Array(Math.floor(cleanStr.length / 2))
    for (let i = 0; i < bytes.length; i++) {
       bytes[i] = parseInt(cleanStr.substring(i * 2, i * 2 + 2), 16)
    }

    if (encoding.value === 'gbk') {
      try {
        const decoder = new TextDecoder('gbk')
        resultText.value = decoder.decode(bytes)
      } catch (err) {
        ElMessage.info('当前浏览器可能不支持 GBK 解码，回退至 UTF-8')
        resultText.value = new TextDecoder('utf-8').decode(bytes)
      }
    } else {
      resultText.value = new TextDecoder('utf-8').decode(bytes)
    }
    
  } catch (e: any) {
    ElMessage.error('转换失败: ' + e.message)
  }
}
</script>

<style scoped>
.custom-textarea :deep(.el-textarea__inner) {
  padding: 1rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}
</style>
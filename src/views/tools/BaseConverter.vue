<template>
  <div class="h-full flex flex-col gap-4">
    <!-- Header Controls -->
    <div class="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 flex-none">
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div class="flex items-center gap-2">
          <div class="p-2 bg-pink-50 dark:bg-pink-900/30 rounded-lg">
            <el-icon class="text-pink-500 text-xl"><Switch /></el-icon>
          </div>
          <div>
            <h2 class="text-lg font-semibold text-slate-800 dark:text-gray-100 m-0">进制转换</h2>
            <p class="text-xs text-slate-500 dark:text-gray-400 m-0 mt-0.5">支持多个数字同转，在线进制相互转化并带有历史记录</p>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2 bg-slate-50 dark:bg-slate-900/50 p-1.5 rounded-lg border border-slate-100 dark:border-slate-700">
          <el-button size="small" type="primary" class="!rounded-md shadow-sm" @click="handleConvert">
            转换并记录
          </el-button>
          <div class="w-px h-4 bg-slate-300 dark:bg-slate-600 mx-1"></div>
          <el-button size="small" type="danger" plain class="!rounded-md" @click="inputText = ''">清空输入</el-button>
        </div>
      </div>

      <!-- Options -->
      <div class="mt-4 flex flex-wrap items-center gap-4 text-sm text-slate-600 dark:text-slate-300">
        <div class="flex items-center gap-2">
          <span class="font-medium">输入类型 (源格式):</span>
          <el-radio-group v-model="inputBase" size="small">
            <el-radio-button :value="2">二进制 (2)</el-radio-button>
            <el-radio-button :value="8">八进制 (8)</el-radio-button>
            <el-radio-button :value="10">十进制 (10)</el-radio-button>
            <el-radio-button :value="16">十六进制 (16)</el-radio-button>
          </el-radio-group>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="flex-1 flex flex-col gap-4 min-h-0">
      <!-- Input Panel -->
      <div class="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col flex-none">
        <div class="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 px-4 py-2 flex items-center justify-between shrink-0">
          <span class="text-sm font-medium text-slate-600 dark:text-slate-300">输入区</span>
          <span class="text-xs text-slate-400 hidden sm:inline-block">使用英文半角逗号 (,) 分隔多个数字。例如: 10, 15, 2A</span>
        </div>
        <el-input
          v-model="inputText"
          type="textarea"
          :rows="3"
          placeholder="请输入待转换数字..."
          class="flex-1 !border-0 flex custom-textarea"
          :input-style="{ resize: 'none', border: 'none', boxShadow: 'none' }"
          @keyup.enter.ctrl="handleConvert"
        />
      </div>

      <!-- History Panel -->
      <div class="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col flex-auto overflow-hidden">
        <div class="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 px-4 py-2 flex items-center justify-between shrink-0">
          <span class="text-sm font-medium text-slate-600 dark:text-slate-300">转换历史</span>
          <el-button type="danger" size="small" plain @click="clearHistory" :disabled="!historyList.length">
            <el-icon class="mr-1"><Delete /></el-icon> 清空历史
          </el-button>
        </div>

        <div class="flex-1 overflow-hidden">
          <el-table
            :data="historyList"
            style="width: 100%"
            height="100%"
            border
            stripe
            table-layout="auto"
          >
            <el-table-column prop="time" label="时间" min-width="100" />
            <el-table-column label="原始输入" min-width="150">
              <template #default="{ row }">
                <span class="font-mono text-blue-600 dark:text-blue-400">{{ row.original }}</span>
                <el-tag size="small" class="ml-2" type="info">{{ row.sourceBase }}进制</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="hex" label="十六进制 (Hex)" min-width="120" class-name="font-mono" />
            <el-table-column prop="dec" label="十进制 (Dec)" min-width="120" class-name="font-mono" />
            <el-table-column prop="oct" label="八进制 (Oct)" min-width="120" class-name="font-mono" />
            <el-table-column prop="bin" label="二进制 (Bin)" min-width="150" class-name="font-mono" />
            <el-table-column label="操作" width="80" align="center" fixed="right">
              <template #default="{ $index }">
                <el-button link type="danger" size="small" @click="removeHistoryItem($index)">
                  删除
                </el-button>
              </template>
            </el-table-column>
            <template #empty>
              <el-empty description="暂无历史转换记录" :image-size="60" />
            </template>
          </el-table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { Switch, Delete } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

interface HistoryRecord {
  id: string
  time: string
  original: string
  sourceBase: number
  hex: string
  dec: string
  oct: string
  bin: string
}

const STORAGE_KEY = 'colathech:secs-tools:base-converter-history'

const inputBase = ref<number>(10)
const inputText = ref<string>('')
const historyList = ref<HistoryRecord[]>([])

// Load history when component mounts
onMounted(() => {
  const savedData = localStorage.getItem(STORAGE_KEY)
  if (savedData) {
    try {
      historyList.value = JSON.parse(savedData)
    } catch (e) {
      console.error('Failed to parse base converter history', e)
    }
  }
})

// Save history when it changes
watch(historyList, (newList) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(newList))
}, { deep: true })

const handleConvert = () => {
  if (!inputText.value.trim()) {
    ElMessage.warning('请输入要转换的数字')
    return
  }

  const rawInputs = inputText.value.split(',')
  const newRecords: HistoryRecord[] = []
  let errorCount = 0

  const now = new Date()
  const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`

  for (let i = 0; i < rawInputs.length; i++) {
    const rawInput = rawInputs[i]
    if (!rawInput) continue
    const rawStr = rawInput.trim()
    if (!rawStr) continue // Skip empty strings like "10, , 20"

    // Parse logic
    // Add negative sign support and strip spaces inside or just parse it strictly?
    // parseInt has limitations, but works fine for most string conversions.
    // Ensure we handle hex prefix manually if entered with inputs etc? Actually parseInt('FF', 16) is clean enough.
    const cleanStr = rawStr.replace(/^0[xXobB]/i, '') // Just in case users manually added prefixes
    const parsedValue = parseInt(cleanStr, inputBase.value)

    if (isNaN(parsedValue)) {
      errorCount++
      continue
    }

    // Convert back out
    // Need conditional handling for negative values in binary/hex representation (often users want two's complement, but here simple -sign is enough for simple base conversion, or unsigned logic)
    // By default JS toString handles negatives with a minus sign `-FF`, `-11`. We'll stick to that default JS behavior.
    newRecords.push({
      id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString() + i,
      time: timeStr,
      original: rawStr,
      sourceBase: inputBase.value,
      hex: parsedValue.toString(16).toUpperCase(),
      dec: parsedValue.toString(10),
      oct: parsedValue.toString(8),
      bin: parsedValue.toString(2)
    })
  }

  if (newRecords.length === 0) {
    if (errorCount > 0) {
      ElMessage.error(`转换失败，输入格式可能与选择的进制(${inputBase.value})不匹配。`)
    }
  } else {
    // Unshift puts newest at the top
    historyList.value.unshift(...newRecords.reverse())

    if (errorCount > 0) {
      ElMessage.warning(`部分转换成功，但忽略了 ${errorCount} 个无效输入。`)
    } else {
      ElMessage.success('转换成功')
    }
    // inputText.value = '' // Optional: clear input after conversion
  }
}

const clearHistory = () => {
  historyList.value = []
  ElMessage.success('历史记录已清空')
}

const removeHistoryItem = (index: number) => {
  historyList.value.splice(index, 1)
}
</script>

<style scoped>
.custom-textarea :deep(.el-textarea__inner) {
  padding: 1rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}
</style>

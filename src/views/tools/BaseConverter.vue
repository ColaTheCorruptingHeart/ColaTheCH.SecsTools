<template>
  <div class="base-converter w-full h-full flex flex-col gap-4 p-4">
    <!-- Header -->
    <div class="flex-none">
      <h2 class="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">进制转换</h2>
      <p class="text-sm text-gray-500">支持输入多个数字，请使用英文半角逗号在同一行内分隔。转换结果将自动保存到历史记录。</p>
    </div>

    <!-- Input Section -->
    <el-card shadow="never" class="flex-none">
      <div class="flex flex-col gap-4">
        <div>
          <span class="text-sm font-medium mr-4">输入类型（源格式）：</span>
          <el-radio-group v-model="inputBase" size="small">
            <el-radio-button :value="2">二进制 (2)</el-radio-button>
            <el-radio-button :value="8">八进制 (8)</el-radio-button>
            <el-radio-button :value="10">十进制 (10)</el-radio-button>
            <el-radio-button :value="16">十六进制 (16)</el-radio-button>
          </el-radio-group>
        </div>

        <div>
          <el-input
            v-model="inputText"
            type="textarea"
            :rows="3"
            placeholder="请输入待转换数字，使用英文逗号 (,) 分隔。例如: 10, 15, 2A"
            clearable
            @keyup.enter.ctrl="handleConvert"
          />
        </div>

        <div class="flex justify-end gap-2">
          <el-button @click="inputText = ''">清空输入</el-button>
          <el-button type="primary" @click="handleConvert">转换并添加到历史</el-button>
        </div>
      </div>
    </el-card>

    <!-- History Section -->
    <el-card shadow="never" class="flex-auto flex flex-col overflow-hidden">
      <template #header>
        <div class="flex justify-between items-center">
          <span class="font-bold">转换历史</span>
          <el-button type="danger" size="small" plain @click="clearHistory" :disabled="!historyList.length">
            清空历史
          </el-button>
        </div>
      </template>

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
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
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
/* Ensure flex layout behaves correctly for the card containers */
:deep(.el-card__body) {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
</style>

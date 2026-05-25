<template>
  <div class="h-full flex flex-col gap-4" v-loading="loading" :element-loading-text="loadingText">
    <input ref="txtFileInputRef" type="file" accept=".txt,text/plain" class="hidden" @change="handleTxtFileChange" />
    <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex-none">
      <div class="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div class="flex items-center gap-3">
          <div class="p-2 bg-blue-50 rounded-lg">
            <el-icon class="text-blue-600 text-xl"><Monitor /></el-icon>
          </div>
          <div>
            <h2 class="text-lg font-semibold text-slate-800 m-0">RecipeBody 分析器</h2>
            <p class="text-xs text-slate-500 m-0 mt-0.5">输入内容即 Body 数据，支持直接粘贴或导入 TXT 文件全文</p>
          </div>
        </div>

        <div class="flex items-center gap-2 flex-wrap">
          <el-button plain :disabled="loading" @click="openTxtFilePicker">导入 TXT</el-button>
          <el-button type="primary" :loading="loading" :disabled="loading" @click="handleAnalyze">解析输入</el-button>
          <el-button type="danger" plain :disabled="loading" @click="clearAll">清空</el-button>
        </div>
      </div>

    </div>

    <div class="flex-1 grid grid-cols-1 xl:grid-cols-[0.95fr_1.05fr] gap-4 min-h-0">
      <div class="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col min-h-0 overflow-hidden">
        <div class="bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center justify-between gap-3 flex-wrap">
          <div class="flex items-center gap-3 flex-wrap">
            <span class="text-sm font-medium text-slate-700">输入区</span>
            <span v-if="importedFileName" class="text-xs text-slate-400">已导入 {{ importedFileName }}</span>
          </div>
          <div class="header-inline-field">
            <span class="header-inline-label">输入类型</span>
            <el-select v-model="inputType" size="small" class="header-inline-select" :disabled="loading">
              <el-option label="自动识别" value="auto" />
              <el-option label="Hex" value="hex" />
              <el-option label="Decimal Array" value="decimal-array" />
              <el-option label="Base64" value="base64" />
            </el-select>
          </div>
        </div>
        <el-input
          v-model="sourceText"
          type="textarea"
          class="flex-1 recipe-body-textarea"
          placeholder="请输入待分析内容..."
          :disabled="loading"
          :input-style="{ height: '100%', resize: 'none', border: 'none', boxShadow: 'none' }"
        />
      </div>

      <div class="flex flex-col gap-4 min-h-0">
        <div class="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col min-h-0 max-h-80 xl:max-h-88 overflow-hidden">
          <div class="bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center justify-between gap-3 flex-wrap">
            <span class="text-sm font-medium text-slate-700">分析摘要</span>
            <div class="flex items-center gap-2">
              <el-tag v-if="result" type="primary">{{ sourceTypeLabel(result.sourceType) }}</el-tag>
              <el-button size="small" text @click="toggleSummaryCollapsed">
                {{ isSummaryCollapsed ? '展开' : '收起' }}
              </el-button>
            </div>
          </div>

          <template v-if="!isSummaryCollapsed && result && analysis">
            <div class="flex-1 min-h-0 overflow-auto p-4 pr-3">
              <div class="flex flex-wrap gap-2 text-xs leading-5">
                <span class="rounded-md bg-slate-50 px-2 py-1 text-slate-600">字节 {{ result.bodyLength }}</span>
                <span class="rounded-md bg-slate-50 px-2 py-1 text-slate-600">输入 {{ result.inputSize }}</span>
                <span class="rounded-md bg-slate-50 px-2 py-1 text-slate-600">熵 {{ analysis.entropy.toFixed(4) }}</span>
                <span class="rounded-md bg-slate-50 px-2 py-1 text-slate-600">ASCII {{ formatRatio(analysis.printableAsciiRatio) }}</span>
                <span class="rounded-md bg-slate-50 px-2 py-1 text-slate-600">NULL {{ formatRatio(analysis.nullByteRatio) }}</span>
                <span class="rounded-md bg-slate-50 px-2 py-1 text-slate-600">高位 {{ formatRatio(analysis.highByteRatio) }}</span>
              </div>

              <div class="mt-2 space-y-2 text-xs text-slate-600">
                <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span>换行 LF {{ analysis.newlineStats.lf }} / CR {{ analysis.newlineStats.cr }} / CRLF {{ analysis.newlineStats.crlf }}</span>
                  <span v-if="analysis.newlineStats.mixed" class="text-amber-600">存在混用</span>
                  <span v-if="analysis.magicMatches.length">文件头签名 {{ analysis.magicMatches.join(' / ') }}</span>
                  <span v-else class="text-slate-400">文件头签名未识别</span>
                </div>

                <div v-if="primaryCandidateFormat" class="rounded-md bg-slate-50 px-3 py-2">
                  <div class="flex items-center justify-between gap-3 text-sm text-slate-800">
                    <span class="font-medium">{{ primaryCandidateFormat.label }}</span>
                    <span class="text-slate-500">{{ formatRatio(primaryCandidateFormat.confidence) }}</span>
                  </div>
                  <div class="mt-0.5 text-xs text-slate-500">{{ primaryCandidateFormat.reason }}</div>
                </div>

                <div v-if="summaryWarningText" class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
                  {{ summaryWarningText }}
                </div>
              </div>
            </div>
          </template>
          <div v-else-if="!isSummaryCollapsed" class="flex-1 p-4 text-sm text-slate-400">完成解析后将显示摘要信息</div>
        </div>

        <div class="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col flex-1 min-h-0 overflow-hidden">
          <div class="bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center justify-between gap-3 flex-wrap">
            <div class="flex items-center gap-3 flex-wrap">
              <span class="text-sm font-medium text-slate-700">转换结果</span>
            </div>
            <div class="flex items-center gap-2 flex-wrap justify-end">
              <div class="header-inline-field">
                <span class="header-inline-label">文本编码</span>
                <el-select v-model="textEncoding" size="small" class="header-inline-select" :disabled="loading">
                  <el-option label="ASCII" value="ascii" />
                  <el-option label="UTF-8" value="utf-8" />
                  <el-option label="UTF-16LE" value="utf-16le" />
                  <el-option label="UTF-16BE" value="utf-16be" />
                  <el-option label="GBK" value="gbk" />
                  <el-option label="Shift-JIS" value="shift-jis" />
                </el-select>
              </div>
              <el-tag v-if="encodingRecommendation" size="small" type="info">
                推荐 {{ formatTextEncodingLabel(encodingRecommendation.encoding) }}
              </el-tag>
              <el-tag v-if="outputResult" type="success">{{ outputResult.label }}</el-tag>
              <el-button size="small" text :disabled="!canCopyOutput" @click="handleCopyOutput">复制</el-button>
            </div>
          </div>

          <template v-if="result">
            <div class="flex-1 min-h-0 overflow-hidden">
              <el-alert
                v-if="outputResult?.mode === 'compressed'"
                type="warning"
                :closable="false"
                show-icon
                :title="outputResult.note || '当前数据可能是压缩包或归档数据，已不再尝试转换为可读字符串。'"
              />
              <template v-else>
                <div v-if="outputDisplayNote" class="px-4 pt-3 text-xs text-slate-500">{{ outputDisplayNote }}</div>
                <el-input
                  :model-value="outputResult?.content || ''"
                  type="textarea"
                  readonly
                  class="h-full recipe-body-textarea"
                  :input-style="{ height: '100%', resize: 'none', border: 'none', boxShadow: 'none' }"
                />
              </template>
            </div>
          </template>
          <div v-else class="flex-1 flex items-center justify-center text-sm text-slate-400">
            完成解析后将显示完整转换结果
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { Monitor } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import type {
  RecipeBodyBasicAnalysis,
  RecipeBodyInputType,
  RecipeBodyNormalizationResult,
  RecipeBodyOutputResult,
  RecipeBodyResolvedInputType,
  RecipeBodyTextEncodingRecommendation,
  RecipeTextEncoding,
} from './recipe-body-analyzer/types'

const loading = ref(false)
const loadingText = ref('正在解析 RecipeBody，请稍候...')

const inputType = ref<RecipeBodyInputType>('auto')
const textEncoding = ref<RecipeTextEncoding>('utf-8')
const sourceText = ref('')
const txtFileInputRef = ref<HTMLInputElement | null>(null)
const importedFileName = ref('')
const result = ref<RecipeBodyNormalizationResult | null>(null)
const analysis = ref<RecipeBodyBasicAnalysis | null>(null)
const outputResult = ref<RecipeBodyOutputResult | null>(null)
const encodingRecommendation = ref<RecipeBodyTextEncodingRecommendation | null>(null)
const isSummaryCollapsed = ref(false)
let skipNextEncodingWatch = false

type AnalyzeWorkerSuccessMessage = {
  type: 'analyze-success'
  normalized: RecipeBodyNormalizationResult
  analysis: RecipeBodyBasicAnalysis
  outputResult: RecipeBodyOutputResult
  encodingRecommendation: RecipeBodyTextEncodingRecommendation | null
  resolvedEncoding: RecipeTextEncoding
}

type OutputWorkerSuccessMessage = {
  type: 'output-success'
  outputResult: RecipeBodyOutputResult
}

type RecipeBodyWorkerErrorMessage = {
  type: 'error'
  message: string
}

type RecipeBodyWorkerResponse = AnalyzeWorkerSuccessMessage | OutputWorkerSuccessMessage | RecipeBodyWorkerErrorMessage

type AnalyzeWorkerRequest = {
  type: 'analyze'
  text: string
  inputType: RecipeBodyInputType
  preferredEncoding: RecipeTextEncoding
}

type OutputWorkerRequest = {
  type: 'resolve-output'
  rawBytes: Uint8Array
  analysis: RecipeBodyBasicAnalysis
  preferredEncoding: RecipeTextEncoding
}

const visibleCandidateFormats = computed(() => analysis.value?.candidateFormats.slice(0, 3) ?? [])

const primaryCandidateFormat = computed(() => visibleCandidateFormats.value[0] ?? null)

const summaryWarnings = computed(() => {
  if (!result.value || !analysis.value) return []
  return [...result.value.warnings, ...analysis.value.warnings]
})

const summaryWarningText = computed(() => summaryWarnings.value.join('；'))

const outputDisplayNote = computed(() => {
  if (!outputResult.value) return ''
  if (outputResult.value.note) return outputResult.value.note
  if (!encodingRecommendation.value || outputResult.value.mode !== 'text-decoded') return ''

  const recommendedLabel = formatTextEncodingLabel(encodingRecommendation.value.encoding)
  const currentLabel = formatTextEncodingLabel(textEncoding.value)

  if (encodingRecommendation.value.encoding === textEncoding.value) {
    return `${encodingRecommendation.value.note} 置信度 ${(encodingRecommendation.value.confidence * 100).toFixed(0)}%。`
  }

  return `系统推荐 ${recommendedLabel} 解码，当前使用 ${currentLabel}。`
})

const canCopyOutput = computed(() => {
  return Boolean(outputResult.value?.content && outputResult.value.mode !== 'compressed')
})

const resetAnalysisState = () => {
  result.value = null
  analysis.value = null
  outputResult.value = null
  encodingRecommendation.value = null
  isSummaryCollapsed.value = false
}

const runRecipeBodyWorker = (request: AnalyzeWorkerRequest | OutputWorkerRequest) => {
  return new Promise<RecipeBodyWorkerResponse>((resolve, reject) => {
    const worker = new Worker(new URL('./recipeBodyAnalyzer.worker.ts', import.meta.url), { type: 'module' })

    const cleanup = () => {
      worker.onmessage = null
      worker.onerror = null
      worker.terminate()
    }

    worker.onmessage = (event: MessageEvent<RecipeBodyWorkerResponse>) => {
      cleanup()
      resolve(event.data)
    }

    worker.onerror = (event) => {
      cleanup()
      reject(new Error(event.message || '解析失败，请检查输入内容'))
    }

    worker.postMessage(request)
  })
}

const rebuildOutputResult = async () => {
  if (!result.value || !analysis.value) {
    outputResult.value = null
    return
  }

  loadingText.value = '正在根据所选编码生成输出，请稍候...'
  loading.value = true

  try {
    const response = await runRecipeBodyWorker({
      type: 'resolve-output',
      rawBytes: result.value.rawBytes,
      analysis: analysis.value,
      preferredEncoding: textEncoding.value,
    })

    if (response.type === 'error') {
      throw new Error(response.message)
    }

    if (response.type !== 'output-success') {
      outputResult.value = response.outputResult
      return
    }

    outputResult.value = response.outputResult
  } catch (error) {
    outputResult.value = null
    ElMessage.error(error instanceof Error ? error.message : '输出生成失败')
  } finally {
    loading.value = false
    loadingText.value = '正在解析 RecipeBody，请稍候...'
  }
}

watch(textEncoding, async () => {
  if (skipNextEncodingWatch) {
    skipNextEncodingWatch = false
    return
  }

  await rebuildOutputResult()
})

const toggleSummaryCollapsed = () => {
  isSummaryCollapsed.value = !isSummaryCollapsed.value
}

const handleCopyOutput = async () => {
  if (!canCopyOutput.value || !outputResult.value) {
    return
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(outputResult.value.content)
    } else {
      const textarea = document.createElement('textarea')
      textarea.value = outputResult.value.content
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.focus()
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }

    ElMessage.success('转换结果已复制')
  } catch {
    ElMessage.error('复制失败，请手动复制结果')
  }
}

const clearAll = () => {
  sourceText.value = ''
  importedFileName.value = ''
  inputType.value = 'auto'
  textEncoding.value = 'utf-8'
  resetAnalysisState()
  if (txtFileInputRef.value) {
    txtFileInputRef.value.value = ''
  }
}

const openTxtFilePicker = () => {
  if (loading.value) {
    return
  }

  txtFileInputRef.value?.click()
}

const handleTxtFileChange = async (event: Event) => {
  const input = event.target as HTMLInputElement | null
  const file = input?.files?.[0]

  if (!file) {
    return
  }

  if (!/\.txt$/i.test(file.name)) {
    ElMessage.error('只支持导入 .txt 文件')
    input.value = ''
    return
  }

  loadingText.value = '正在读取 TXT 文件，请稍候...'
  loading.value = true

  try {
    const text = await file.text()
    sourceText.value = text
    importedFileName.value = file.name
    resetAnalysisState()
    ElMessage.success(`已导入 TXT 文件：${file.name}`)
  } catch {
    ElMessage.error('TXT 文件读取失败，请确认文件内容可读')
  } finally {
    input.value = ''
    loading.value = false
    loadingText.value = '正在解析 RecipeBody，请稍候...'
  }
}

const handleAnalyze = async () => {
  if (loading.value) {
    return
  }

  loading.value = true
  loadingText.value = '正在解析 RecipeBody，请稍候...'

  try {
    await nextTick()

    const response = await runRecipeBodyWorker({
      type: 'analyze',
      text: sourceText.value,
      inputType: inputType.value,
      preferredEncoding: textEncoding.value,
    })

    if (response.type === 'error') {
      throw new Error(response.message)
    }

    if (response.type !== 'analyze-success') {
      throw new Error('解析结果类型异常')
    }

    result.value = response.normalized
    analysis.value = response.analysis
    encodingRecommendation.value = response.encodingRecommendation
    outputResult.value = response.outputResult
    skipNextEncodingWatch = true
    textEncoding.value = response.resolvedEncoding
    ElMessage.success('解析完成')
  } catch (error) {
    resetAnalysisState()
    ElMessage.error(error instanceof Error ? error.message : '解析失败')
  } finally {
    loading.value = false
    loadingText.value = '正在解析 RecipeBody，请稍候...'
  }
}

const formatRatio = (value: number) => `${(value * 100).toFixed(2)}%`

const formatTextEncodingLabel = (encoding: RecipeTextEncoding) => {
  switch (encoding) {
    case 'utf-8':
      return 'UTF-8'
    case 'utf-16le':
      return 'UTF-16LE'
    case 'utf-16be':
      return 'UTF-16BE'
    case 'shift-jis':
      return 'Shift-JIS'
    case 'ascii':
      return 'ASCII'
    case 'gbk':
      return 'GBK'
    default:
      return encoding
  }
}

const sourceTypeLabel = (type: RecipeBodyResolvedInputType) => {
  switch (type) {
    case 'hex':
      return 'Hex'
    case 'decimal-array':
      return 'Decimal Array'
    case 'base64':
      return 'Base64'
    case 'text':
      return '原文'
    default:
      return type
  }
}
</script>

<style scoped>
.recipe-body-textarea :deep(.el-textarea),
.recipe-body-textarea :deep(.el-textarea__inner) {
  height: 100%;
}

.recipe-body-textarea :deep(.el-textarea__inner) {
  padding: 1rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  line-height: 1.6;
}

.header-inline-field {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: nowrap;
  flex-shrink: 0;
}

.header-inline-label {
  font-size: 0.75rem;
  color: rgb(100 116 139);
  white-space: nowrap;
  line-height: 1;
}

.header-inline-select {
  width: 9rem;
  min-width: 9rem;
}

.header-inline-select :deep(.el-select__selected-item),
.header-inline-select :deep(.el-select__placeholder) {
  white-space: nowrap;
}
</style>

<template>
  <div class="h-full flex flex-col gap-4">
    <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex-none">
      <div class="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div class="flex items-center gap-3">
          <div class="p-2 bg-blue-50 rounded-lg">
            <el-icon class="text-blue-600 text-xl"><Monitor /></el-icon>
          </div>
          <div>
            <h2 class="text-lg font-semibold text-slate-800 m-0">RecipeBody 分析器</h2>
            <p class="text-xs text-slate-500 m-0 mt-0.5">输入内容即 Body 数据，解析后直接展示分析结果</p>
          </div>
        </div>

        <div class="flex items-center gap-2 flex-wrap">
          <el-button type="primary" :loading="loading" @click="handleAnalyze">解析输入</el-button>
          <el-button type="danger" plain @click="clearAll">清空</el-button>
        </div>
      </div>

    </div>

    <div class="flex-1 grid grid-cols-1 xl:grid-cols-[0.95fr_1.05fr] gap-4 min-h-0">
      <div class="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col min-h-0 overflow-hidden">
        <div class="bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center justify-between gap-3 flex-wrap">
          <div class="flex items-center gap-3 flex-wrap">
            <span class="text-sm font-medium text-slate-700">输入区</span>
          </div>
          <div class="header-inline-field">
            <span class="header-inline-label">输入类型</span>
            <el-select v-model="inputType" size="small" class="header-inline-select">
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
                <el-select v-model="textEncoding" size="small" class="header-inline-select">
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
import { computed, ref, watch } from 'vue'
import { Monitor } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { analyzeRecipeBodyBytes } from './recipe-body-analyzer/analysis'
import { normalizeRecipeBodyInput, recommendRecipeBodyTextEncoding, resolveRecipeBodyOutput } from './recipe-body-analyzer/input'
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

const inputType = ref<RecipeBodyInputType>('auto')
const textEncoding = ref<RecipeTextEncoding>('utf-8')
const sourceText = ref('')
const result = ref<RecipeBodyNormalizationResult | null>(null)
const analysis = ref<RecipeBodyBasicAnalysis | null>(null)
const outputResult = ref<RecipeBodyOutputResult | null>(null)
const encodingRecommendation = ref<RecipeBodyTextEncodingRecommendation | null>(null)
const isSummaryCollapsed = ref(false)

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

const rebuildOutputResult = () => {
  if (!result.value || !analysis.value) {
    outputResult.value = null
    return
  }

  outputResult.value = resolveRecipeBodyOutput(result.value.rawBytes, textEncoding.value, analysis.value)
}

watch(textEncoding, () => {
  rebuildOutputResult()
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
  inputType.value = 'auto'
  textEncoding.value = 'utf-8'
  result.value = null
  analysis.value = null
  outputResult.value = null
  encodingRecommendation.value = null
  isSummaryCollapsed.value = false
}

const handleAnalyze = async () => {
  loading.value = true
  try {
    const normalized = await normalizeRecipeBodyInput({
      inputType: inputType.value,
      text: sourceText.value,
    })
    result.value = normalized
    const nextAnalysis = await analyzeRecipeBodyBytes(normalized.rawBytes)
    analysis.value = nextAnalysis
    encodingRecommendation.value = recommendRecipeBodyTextEncoding(normalized.rawBytes, nextAnalysis, textEncoding.value)

    if (encodingRecommendation.value && encodingRecommendation.value.encoding !== textEncoding.value) {
      textEncoding.value = encodingRecommendation.value.encoding
    } else {
      rebuildOutputResult()
    }
    ElMessage.success('解析完成')
  } catch (error) {
    result.value = null
    analysis.value = null
    outputResult.value = null
    encodingRecommendation.value = null
    ElMessage.error(error instanceof Error ? error.message : '归一化失败')
  } finally {
    loading.value = false
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

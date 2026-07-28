<template>
  <el-dialog
    :model-value="modelValue"
    title="SECS 日志语义差异分析"
    width="86vw"
    align-center
    :close-on-click-modal="false"
    class="secs-log-diff-input"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="input-grid">
      <section class="input-pane">
        <header class="input-pane__header">
          <span>Baseline</span>
          <span>{{ getStats(baselineText) }}</span>
        </header>
        <div class="input-pane__actions">
          <el-button size="small" plain @click="baselineFileInput?.click()">导入文件</el-button>
          <input ref="baselineFileInput" class="hidden" type="file" accept=".log,.txt,.sml" @change="handleFileChange($event, 'baseline')" />
        </div>
        <div class="input-editor">
          <Codemirror
            :model-value="baselineText"
            placeholder="粘贴 baseline 日志..."
            :style="{ height: '100%' }"
            :extensions="extensions"
            @update:model-value="emit('update:baselineText', $event)"
          />
        </div>
      </section>

      <section class="input-pane">
        <header class="input-pane__header">
          <span>Target</span>
          <span>{{ getStats(targetText) }}</span>
        </header>
        <div class="input-pane__actions">
          <el-button size="small" plain @click="targetFileInput?.click()">导入文件</el-button>
          <input ref="targetFileInput" class="hidden" type="file" accept=".log,.txt,.sml" @change="handleFileChange($event, 'target')" />
        </div>
        <div class="input-editor">
          <Codemirror
            :model-value="targetText"
            placeholder="粘贴 target 日志..."
            :style="{ height: '100%' }"
            :extensions="extensions"
            @update:model-value="emit('update:targetText', $event)"
          />
        </div>
      </section>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <span>  </span>
        <div class="dialog-footer__actions">
          <el-checkbox :model-value="includeEqualRows" @update:model-value="emit('update:includeEqualRows', Boolean($event))">
            显示一致消息
          </el-checkbox>
          <el-button plain @click="emit('clear')">清空</el-button>
          <el-button type="primary" :loading="loading" @click="emit('analyze')">开始分析</el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Codemirror } from 'vue-codemirror'
import type { Extension } from '@codemirror/state'
import { ElMessage } from 'element-plus'
import { countLines } from '../../secs-log/text-metrics'

defineProps<{
  modelValue: boolean
  baselineText: string
  targetText: string
  includeEqualRows: boolean
  loading: boolean
  extensions: Extension[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'update:baselineText': [value: string]
  'update:targetText': [value: string]
  'update:includeEqualRows': [value: boolean]
  analyze: []
  clear: []
}>()

const baselineFileInput = ref<HTMLInputElement | null>(null)
const targetFileInput = ref<HTMLInputElement | null>(null)

function getStats(text: string) {
  return `${countLines(text).toLocaleString()} 行 / ${text.length.toLocaleString()} 字符`
}

async function handleFileChange(event: Event, side: 'baseline' | 'target') {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) {
    return
  }

  try {
    const text = await file.text()
    if (side === 'baseline') {
      emit('update:baselineText', text)
    } else {
      emit('update:targetText', text)
    }
    ElMessage.success(`${file.name} 已导入`)
  } catch (error: unknown) {
    ElMessage.error(error instanceof Error ? error.message : '读取文件失败')
  } finally {
    input.value = ''
  }
}
</script>

<style scoped>
.input-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 10px;
  height: min(72vh, 760px);
  min-height: 520px;
}

.input-pane {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid #dbe3ef;
  border-radius: 8px;
  background: #ffffff;
}

.input-pane__header,
.input-pane__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
  padding: 8px 12px;
  color: #475569;
  font-size: 13px;
  font-weight: 600;
}

.input-pane__header span:last-child {
  color: #94a3b8;
  font-size: 12px;
  font-weight: 500;
}

.input-pane__actions {
  justify-content: flex-end;
  padding: 6px 10px;
}

.input-editor {
  min-height: 0;
  flex: 1;
  overflow: hidden;
}

.hidden {
  display: none;
}

.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
}

.dialog-footer span {
  color: #64748b;
  font-size: 12px;
}

.dialog-footer__actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

@media (max-width: 900px) {
  .input-grid {
    grid-template-columns: 1fr;
    height: 76vh;
    min-height: 0;
  }

  .dialog-footer {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>

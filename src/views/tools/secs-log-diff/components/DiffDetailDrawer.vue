<template>
  <el-drawer
    :model-value="modelValue"
    title="差异详情"
    direction="rtl"
    size="85%"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div v-if="row" class="detail">
      <section class="detail__summary">
        <div class="detail__title-row">
          <span class="detail__kind" :class="`detail__kind--${row.kind}`">{{ kindLabel }}</span>
          <span class="detail__severity">{{ row.severity }}</span>
        </div>
        <h3>{{ row.title }}</h3>
        <p>{{ row.detail }}</p>
      </section>

      <section class="detail__section">
        <h4>定位</h4>
        <dl>
          <div>
            <dt>Baseline</dt>
            <dd>{{ row.baselineOriginalLine ? `line ${row.baselineOriginalLine}` : '-' }}</dd>
          </div>
          <div>
            <dt>Target</dt>
            <dd>{{ row.targetOriginalLine ? `line ${row.targetOriginalLine}` : '-' }}</dd>
          </div>
          <div>
            <dt>Baseline key</dt>
            <dd>{{ row.baselineKey || '-' }}</dd>
          </div>
          <div>
            <dt>Target key</dt>
            <dd>{{ row.targetKey || '-' }}</dd>
          </div>
          <div>
            <dt>语义摘要</dt>
            <dd>{{ row.semanticSummary || '-' }}</dd>
          </div>
          <div>
            <dt>事务</dt>
            <dd>{{ row.transactionSummary || '-' }}</dd>
          </div>
          <div>
            <dt>ACK</dt>
            <dd>{{ row.ackSummary || '-' }}</dd>
          </div>
          <div>
            <dt>时序</dt>
            <dd>{{ row.timingSummary || '-' }}</dd>
          </div>
        </dl>
      </section>

      <section class="detail__section detail__section--diff">
        <div class="detail__section-head">
          <h4>消息差异</h4>
          <span>Side by side</span>
        </div>

        <div class="message-diff-wrap">
          <CodeDiff
            v-if="formattedBaseline || formattedTarget"
            :old-string="formattedBaseline"
            :new-string="formattedTarget"
            language="plaintext"
            output-format="side-by-side"
            diff-style="word"
            :context="8"
            :force-inline-comparison="false"
            :no-diff-line-feed="true"
            filename="Baseline SML"
            new-filename="Target SML"
          />
          <el-empty v-else description="没有可显示的消息内容" :image-size="52" />
        </div>
      </section>
    </div>
    <el-empty v-else description="请选择一个差异项" />
  </el-drawer>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { CodeDiff } from 'v-code-diff'
import { formatSecsSml } from '../../secs-log/sml'
import type { SecsDiffRenderRow, SecsLogDiffKind } from '../types'

const props = defineProps<{
  modelValue: boolean
  row: SecsDiffRenderRow | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const kindLabel = computed(() => {
  if (props.row?.kind === 'timing_changed') {
    return '时序变化'
  }

  const labels: Partial<Record<SecsLogDiffKind, string>> = {
    equal: '一致',
    added: '新增',
    missing: '缺失',
    changed: '变化',
    field_changed: '字段变化',
    ack_error: 'ACK 异常',
    unmatched_reply: '回复缺失',
    parse_error: '解析失败'
  }
  return props.row ? labels[props.row.kind] || '' : ''
})

const formattedBaseline = computed(() => formatMessageText(props.row?.baselineText || ''))
const formattedTarget = computed(() => formatMessageText(props.row?.targetText || ''))

function formatMessageText(text: string) {
  if (!text.trim()) {
    return ''
  }

  try {
    return formatSecsSml(text).text
  } catch {
    return text
  }
}
</script>

<style scoped>
:deep(.el-drawer__body) {
  background: #f8fafc;
  padding: 12px;
  overflow-y: auto;
}

.detail {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
  min-height: 100%;
  align-content: start;
}

.detail__summary,
.detail__section {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #ffffff;
  padding: 12px;
}

.detail__summary {
  min-width: 0;
}

.detail__title-row,
.detail__section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.detail__kind,
.detail__severity,
.detail__section-head span {
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 11px;
  font-weight: 700;
  line-height: 16px;
}

.detail__kind {
  background: #f1f5f9;
  color: #334155;
}

.detail__kind--added {
  background: #dcfce7;
  color: #047857;
}

.detail__kind--missing {
  background: #fee2e2;
  color: #b91c1c;
}

.detail__kind--changed,
.detail__kind--field_changed {
  background: #fef3c7;
  color: #b45309;
}

.detail__kind--ack_error {
  background: #fee2e2;
  color: #991b1b;
}

.detail__kind--unmatched_reply,
.detail__kind--parse_error {
  background: #ede9fe;
  color: #6d28d9;
}

.detail__kind--timing_changed {
  background: #e0f2fe;
  color: #0369a1;
}

.detail__severity,
.detail__section-head span {
  background: #f8fafc;
  color: #64748b;
}

.detail h3 {
  margin: 0;
  color: #1e293b;
  font-size: 15px;
  line-height: 22px;
}

.detail p {
  margin: 6px 0 0;
  color: #64748b;
  font-size: 13px;
  line-height: 20px;
}

.detail h4 {
  margin: 0 0 8px;
  color: #334155;
  font-size: 13px;
  font-weight: 700;
  line-height: 18px;
}

.detail__section-head h4 {
  margin-bottom: 0;
}

.detail dl {
  display: grid;
  gap: 7px;
  margin: 0;
}

.detail dl div {
  display: grid;
  grid-template-columns: 100px minmax(0, 1fr);
  gap: 8px;
}

.detail dt {
  color: #64748b;
  font-size: 12px;
}

.detail dd {
  min-width: 0;
  overflow-wrap: anywhere;
  margin: 0;
  color: #334155;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 12px;
}

.message-diff-wrap {
  position: relative;
  min-height: 0;
  overflow: visible;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #ffffff;
}

.message-diff-wrap :deep(.code-diff-view) {
  margin: 0;
  padding-right: 0;
  border: 0;
  border-radius: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}

.message-diff-wrap :deep(.code-diff-view .file-header) {
  background: #f8fafc;
  border-bottom-color: #e2e8f0;
}

.message-diff-wrap :deep(.code-diff-view .diff-table .blob-code-inner),
.message-diff-wrap :deep(.code-diff-view .diff-table .blob-num) {
  font-size: 12px;
  line-height: 20px;
}

.message-diff-wrap :deep(.code-diff-view::-webkit-scrollbar) {
  width: 14px;
  height: 14px;
  background-color: transparent;
}

.message-diff-wrap :deep(.code-diff-view::-webkit-scrollbar-track) {
  background-color: transparent;
}

.message-diff-wrap :deep(.code-diff-view::-webkit-scrollbar-thumb) {
  border: 4px solid transparent;
  border-radius: 9999px;
  background-color: rgba(100, 116, 139, 0.8);
  background-clip: padding-box;
}

.message-diff-wrap :deep(.code-diff-view::-webkit-scrollbar-thumb:hover) {
  background-color: rgba(71, 85, 105, 1);
}

.message-diff-wrap :deep(.code-diff-view::-webkit-scrollbar-corner) {
  background-color: transparent;
}

@media (max-width: 1100px) {
  .detail {
    grid-template-columns: 1fr;
  }
}
</style>

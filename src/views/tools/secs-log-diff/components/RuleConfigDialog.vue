<template>
  <el-dialog
    :model-value="modelValue"
    title="规则配置"
    width="88vw"
    align-center
    class="rule-config-dialog"
    @update:model-value="emit('update:modelValue', $event)"
    @open="resetDraft"
  >
    <div class="rule-config">
      <header class="rule-config__toolbar">
        <div class="profile-fields">
          <el-input v-model="draft.name" size="small" class="profile-fields__name" placeholder="Profile name" />
          <el-input v-model="draft.id" size="small" class="profile-fields__id" placeholder="Profile id" />
        </div>
        <div class="rule-config__actions">
          <el-button size="small" plain @click="fileInputRef?.click()">导入 JSON</el-button>
          <el-button size="small" plain @click="emit('export')">导出 JSON</el-button>
          <el-button size="small" plain @click="restoreDefault">恢复默认</el-button>
          <input ref="fileInputRef" class="hidden" type="file" accept=".json" @change="importProfileFile" />
        </div>
      </header>

      <el-tabs v-model="activeTab" class="rule-config__tabs" @tab-change="handleTabChange">
        <el-tab-pane label="界面配置" name="rules">
          <div class="rule-workbench">
            <aside class="rule-list">
              <div class="rule-list__head">
                <span>消息规则</span>
                <el-button size="small" type="primary" plain @click="addRule">新增</el-button>
              </div>
              <div class="rule-list__body">
                <button
                  v-for="(rule, index) in draft.rules"
                  :key="rule.id || index"
                  type="button"
                  class="rule-list__item"
                  :class="{ 'is-active': index === selectedRuleIndex }"
                  @click="selectedRuleIndex = index"
                >
                  <span class="rule-list__sf">{{ rule.sf || 'SxFy' }}</span>
                  <span class="rule-list__meta">{{ getModeLabel(rule.mode) }} / {{ rule.desc || rule.id }}</span>
                </button>
              </div>
            </aside>

            <main v-if="selectedRule" class="rule-editor">
              <section class="editor-section">
                <div class="editor-section__head">
                  <h3>基础</h3>
                  <el-button size="small" type="danger" plain :disabled="draft.rules.length <= 1" @click="removeSelectedRule">删除规则</el-button>
                </div>
                <div class="basic-grid">
                  <label>
                    <span>启用</span>
                    <el-switch v-model="selectedRule.enabled" />
                  </label>
                  <label>
                    <span>S/F</span>
                    <el-input v-model="selectedRule.sf" placeholder="S6F11 / S9*" />
                  </label>
                  <label>
                    <span>模式</span>
                    <el-select v-model="selectedRule.mode">
                      <el-option label="忽略" value="ignore" />
                      <el-option label="只看存在" value="presence" />
                      <el-option label="只看 Key" value="key-only" />
                      <el-option label="字段" value="field" />
                      <el-option label="原文" value="raw" />
                    </el-select>
                  </label>
                  <label class="basic-grid__wide">
                    <span>说明</span>
                    <el-input v-model="selectedRule.desc" placeholder="规则说明" />
                  </label>
                </div>
              </section>

              <section class="editor-section">
                <div class="editor-section__head">
                  <h3>Key 路径</h3>
                  <el-button size="small" plain @click="addPathRule('key')">新增 Key</el-button>
                </div>
                <el-table :data="selectedRule.keyPaths" size="small" class="path-table">
                  <el-table-column label="名称" min-width="130">
                    <template #default="{ row }">
                      <el-input v-model="row.label" size="small" placeholder="CEID" />
                    </template>
                  </el-table-column>
                  <el-table-column label="路径" min-width="130">
                    <template #default="{ row }">
                      <el-input v-model="row.path" size="small" placeholder="[0][1]" />
                    </template>
                  </el-table-column>
                  <el-table-column label="取值" width="118">
                    <template #default="{ row }">
                      <el-select v-model="row.valueMode" size="small" placeholder="叶子值">
                        <el-option label="叶子值" value="value" />
                        <el-option label="子树" value="subtree" />
                      </el-select>
                    </template>
                  </el-table-column>
                  <el-table-column label="必填" width="72" align="center">
                    <template #default="{ row }">
                      <el-checkbox v-model="row.required" />
                    </template>
                  </el-table-column>
                  <el-table-column label="操作" width="72" align="center">
                    <template #default="{ $index }">
                      <el-button size="small" text type="danger" @click="removePathRule('key', $index)">删除</el-button>
                    </template>
                  </el-table-column>
                </el-table>
              </section>

              <section class="editor-section">
                <div class="editor-section__head">
                  <h3>比较路径</h3>
                  <el-button size="small" plain @click="addPathRule('field')">新增比较项</el-button>
                </div>
                <el-table :data="selectedRule.fieldPaths" size="small" class="path-table">
                  <el-table-column label="名称" min-width="130">
                    <template #default="{ row }">
                      <el-input v-model="row.label" size="small" placeholder="Body" />
                    </template>
                  </el-table-column>
                  <el-table-column label="路径" min-width="130">
                    <template #default="{ row }">
                      <el-input v-model="row.path" size="small" placeholder="[0][2]" />
                    </template>
                  </el-table-column>
                  <el-table-column label="取值" width="118">
                    <template #default="{ row }">
                      <el-select v-model="row.valueMode" size="small" placeholder="叶子值">
                        <el-option label="叶子值" value="value" />
                        <el-option label="子树" value="subtree" />
                      </el-select>
                    </template>
                  </el-table-column>
                  <el-table-column label="参与比较" width="92" align="center">
                    <template #default="{ row }">
                      <el-checkbox v-model="row.compare" />
                    </template>
                  </el-table-column>
                  <el-table-column label="操作" width="72" align="center">
                    <template #default="{ $index }">
                      <el-button size="small" text type="danger" @click="removePathRule('field', $index)">删除</el-button>
                    </template>
                  </el-table-column>
                </el-table>
              </section>

              <section class="editor-section">
                <div>
                  <div class="editor-section__head">
                    <h3>忽略路径</h3>
                    <el-button size="small" plain @click="addIgnorePath">新增忽略项</el-button>
                  </div>
                  <div class="path-list">
                    <div v-for="(_, index) in selectedIgnorePaths" :key="index" class="path-list__row">
                      <el-input v-model="selectedIgnorePaths[index]" size="small" placeholder="[0][0]" />
                      <el-button size="small" text type="danger" @click="removeIgnorePath(index)">删除</el-button>
                    </div>
                    <el-empty v-if="!selectedIgnorePaths.length" description="未配置忽略路径" :image-size="42" />
                  </div>
                </div>
              </section>
            </main>

            <el-empty v-else class="rule-editor-empty" description="请新增或选择一条规则" />
          </div>
        </el-tab-pane>

        <el-tab-pane label="JSON 高级配置" name="json">
          <el-input
            v-model="jsonDraft"
            type="textarea"
            resize="none"
            class="rule-config__json"
            spellcheck="false"
          />
        </el-tab-pane>
      </el-tabs>
    </div>

    <template #footer>
      <div class="rule-config__footer">
        <span>规则会在下一次分析时生效。</span>
        <div>
          <el-button @click="emit('update:modelValue', false)">取消</el-button>
          <el-button type="primary" @click="applyDraft">应用规则</el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { cloneDefaultProfile, normalizeProfile } from '../rules'
import type {
  DiffPathRule,
  MessageDiffRule,
  SecsLogDiffProfile
} from '../types'

const props = defineProps<{
  modelValue: boolean
  profile: SecsLogDiffProfile
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  apply: [profile: SecsLogDiffProfile]
  export: []
}>()

const activeTab = ref<'rules' | 'json'>('rules')
const draft = ref<SecsLogDiffProfile>(cloneProfile(props.profile))
const jsonDraft = ref('')
const fileInputRef = ref<HTMLInputElement | null>(null)
const selectedRuleIndex = ref(0)

const selectedRule = computed(() => {
  const rule = draft.value.rules[selectedRuleIndex.value]
  if (!rule) {
    return null
  }

  ensureEditableRule(rule)
  return rule
})

const selectedIgnorePaths = computed(() => selectedRule.value?.ignorePaths || [])

function cloneProfile(profile: SecsLogDiffProfile) {
  return JSON.parse(JSON.stringify(profile)) as SecsLogDiffProfile
}

function ensureEditableRule(rule: MessageDiffRule) {
  rule.keyPaths ||= []
  rule.fieldPaths ||= []
  rule.ignorePaths ||= []
  rule.severity ||= {}
  rule.enabled = rule.enabled !== false
}

function createRule(): MessageDiffRule {
  const timestamp = Date.now()
  return {
    id: `custom-rule-${timestamp}`,
    enabled: true,
    sf: 'SxFy',
    mode: 'field',
    keyPaths: [],
    fieldPaths: [],
    ignorePaths: [],
    desc: '',
    severity: {}
  }
}

function createPathRule(kind: 'key' | 'field'): DiffPathRule {
  const timestamp = Date.now()
  return {
    id: `${kind}-path-${timestamp}`,
    label: kind === 'key' ? 'KEY' : 'FIELD',
    path: '[0]',
    valueMode: 'value',
    compare: kind === 'field',
    required: kind === 'key'
  }
}

function syncJsonFromDraft() {
  jsonDraft.value = JSON.stringify(draft.value, null, 2)
}

function parseJsonIntoDraft() {
  draft.value = normalizeProfile(JSON.parse(jsonDraft.value))
  draft.value.rules.forEach(ensureEditableRule)
  selectedRuleIndex.value = Math.min(selectedRuleIndex.value, Math.max(0, draft.value.rules.length - 1))
}

function resetDraft() {
  draft.value = cloneProfile(props.profile)
  draft.value.rules.forEach(ensureEditableRule)
  selectedRuleIndex.value = 0
  activeTab.value = 'rules'
  syncJsonFromDraft()
}

function restoreDefault() {
  draft.value = cloneDefaultProfile()
  draft.value.rules.forEach(ensureEditableRule)
  selectedRuleIndex.value = 0
  activeTab.value = 'rules'
  syncJsonFromDraft()
}

function getModeLabel(mode: MessageDiffRule['mode']) {
  const labels: Record<MessageDiffRule['mode'], string> = {
    ignore: '忽略',
    presence: '只看存在',
    'key-only': '只看 Key',
    field: '字段',
    raw: '原文'
  }
  return labels[mode] || mode
}

function addRule() {
  draft.value.rules.push(createRule())
  selectedRuleIndex.value = draft.value.rules.length - 1
}

function removeSelectedRule() {
  if (draft.value.rules.length <= 1) {
    return
  }

  draft.value.rules.splice(selectedRuleIndex.value, 1)
  selectedRuleIndex.value = Math.min(selectedRuleIndex.value, draft.value.rules.length - 1)
}

function addPathRule(kind: 'key' | 'field') {
  if (!selectedRule.value) {
    return
  }

  if (kind === 'key') {
    selectedRule.value.keyPaths.push(createPathRule(kind))
  } else {
    selectedRule.value.fieldPaths.push(createPathRule(kind))
  }
}

function removePathRule(kind: 'key' | 'field', index: number) {
  if (!selectedRule.value) {
    return
  }

  if (kind === 'key') {
    selectedRule.value.keyPaths.splice(index, 1)
  } else {
    selectedRule.value.fieldPaths.splice(index, 1)
  }
}

function addIgnorePath() {
  if (!selectedRule.value) {
    return
  }

  selectedRule.value.ignorePaths ||= []
  selectedRule.value.ignorePaths.push('[0]')
}

function removeIgnorePath(index: number) {
  selectedRule.value?.ignorePaths?.splice(index, 1)
}

function normalizeDraftForApply(source: unknown) {
  const normalized = normalizeProfile(source)
  normalized.rules.forEach(rule => {
    rule.keyPaths.forEach(pathRule => {
      if (pathRule.valueMode === 'value') {
        delete pathRule.valueMode
      }
    })
    rule.fieldPaths.forEach(pathRule => {
      if (pathRule.valueMode === 'value') {
        delete pathRule.valueMode
      }
    })
    if (!rule.ignorePaths?.length) {
      delete rule.ignorePaths
    }
    if (rule.severity && Object.keys(rule.severity).length === 0) {
      delete rule.severity
    }
  })
  return normalized
}

async function importProfileFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) {
    return
  }

  try {
    draft.value = normalizeProfile(JSON.parse(await file.text()))
    draft.value.rules.forEach(ensureEditableRule)
    activeTab.value = 'rules'
    selectedRuleIndex.value = 0
    syncJsonFromDraft()
    ElMessage.success(`已导入规则：${draft.value.name}`)
  } catch (error: unknown) {
    ElMessage.error(error instanceof Error ? error.message : '规则导入失败')
  } finally {
    input.value = ''
  }
}

function handleTabChange(tabName: string | number) {
  if (tabName === 'json') {
    syncJsonFromDraft()
    return
  }

  if (activeTab.value === 'rules' && jsonDraft.value.trim()) {
    try {
      parseJsonIntoDraft()
    } catch (error: unknown) {
      ElMessage.error(error instanceof Error ? error.message : 'JSON 配置无效')
      activeTab.value = 'json'
    }
  }
}

function applyDraft() {
  try {
    const source = activeTab.value === 'json' ? JSON.parse(jsonDraft.value) : draft.value
    const normalized = normalizeDraftForApply(source)
    emit('apply', normalized)
    emit('update:modelValue', false)
  } catch (error: unknown) {
    ElMessage.error(error instanceof Error ? error.message : '规则配置无效')
  }
}

watch(
  draft,
  () => {
    if (activeTab.value === 'rules') {
      syncJsonFromDraft()
    }
  },
  { deep: true }
)
</script>

<style scoped>
.rule-config {
  display: flex;
  height: min(76vh, 820px);
  min-height: 560px;
  flex-direction: column;
  gap: 10px;
}

.rule-config__toolbar,
.rule-config__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.profile-fields {
  display: grid;
  min-width: 0;
  flex: 1;
  grid-template-columns: minmax(180px, 320px) minmax(160px, 260px);
  gap: 8px;
}

.rule-config__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.rule-config__tabs {
  min-height: 0;
  flex: 1;
}

.rule-config__tabs :deep(.el-tabs__content) {
  height: calc(100% - 48px);
}

.rule-config__tabs :deep(.el-tab-pane) {
  height: 100%;
}

.rule-workbench {
  display: grid;
  height: 100%;
  min-height: 0;
  grid-template-columns: 250px minmax(0, 1fr);
  gap: 10px;
}

.rule-list,
.rule-editor,
.rule-editor-empty {
  min-height: 0;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #ffffff;
}

.rule-list {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.rule-list__head,
.editor-section__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.rule-list__head {
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
  padding: 9px 10px;
  color: #334155;
  font-size: 13px;
  font-weight: 700;
}

.rule-list__body {
  min-height: 0;
  flex: 1;
  overflow: auto;
  padding: 6px;
}

.rule-list__item {
  display: grid;
  width: 100%;
  gap: 2px;
  border: 0;
  border-left: 3px solid transparent;
  border-radius: 0 6px 6px 0;
  background: transparent;
  padding: 8px 9px;
  text-align: left;
  cursor: pointer;
}

.rule-list__item:hover,
.rule-list__item.is-active {
  border-left-color: #2563eb;
  background: #f8fafc;
}

.rule-list__sf {
  color: #1e293b;
  font-size: 13px;
  font-weight: 700;
  line-height: 18px;
}

.rule-list__meta {
  overflow: hidden;
  color: #64748b;
  font-size: 12px;
  line-height: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rule-editor {
  overflow: auto;
  padding: 10px;
}

.rule-editor-empty {
  display: grid;
  place-items: center;
}

.editor-section {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #ffffff;
  padding: 10px;
}

.editor-section + .editor-section {
  margin-top: 10px;
}

.editor-section__head {
  margin-bottom: 8px;
}

.editor-section__head h3 {
  margin: 0;
  color: #334155;
  font-size: 13px;
  font-weight: 700;
  line-height: 18px;
}

.basic-grid {
  display: grid;
  gap: 8px;
}

.basic-grid {
  grid-template-columns: 90px repeat(2, minmax(0, 1fr));
}

.basic-grid__wide {
  grid-column: 1 / -1;
}

.basic-grid label {
  display: grid;
  gap: 4px;
  min-width: 0;
  color: #64748b;
  font-size: 12px;
  line-height: 16px;
}

.path-table {
  width: 100%;
}

.path-list {
  display: grid;
  gap: 6px;
}

.path-list__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 6px;
}

.rule-config__json {
  height: 100%;
}

.rule-config__json :deep(.el-textarea__inner) {
  height: 100%;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 12px;
  line-height: 1.55;
}

.rule-config__footer span {
  color: #64748b;
  font-size: 12px;
}

.hidden {
  display: none;
}

@media (max-width: 1100px) {
  .profile-fields,
  .rule-workbench,
  .basic-grid {
    grid-template-columns: 1fr;
  }

  .rule-config__toolbar,
  .rule-config__footer {
    align-items: flex-start;
    flex-direction: column;
  }

  .rule-list {
    min-height: 180px;
  }
}
</style>

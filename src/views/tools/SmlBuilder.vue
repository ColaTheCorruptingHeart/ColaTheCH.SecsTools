<template>
  <div ref="pageRoot" class="sml-builder-page relative h-full min-h-0 flex flex-col gap-2">
    <section class="editor-shell flex-1 min-h-0 flex flex-col gap-2" aria-labelledby="sml-builder-title">
      <header class="editor-header shrink-0 rounded-xl border border-slate-200 bg-white shadow-sm">
        <div class="editor-brand">
          <div class="editor-brand__icon"><el-icon><SetUp /></el-icon></div>
          <div>
            <h2 id="sml-builder-title">SML 构造器</h2>
            <small>直接编辑节点、类型与层级</small>
          </div>
        </div>

        <div class="header-actions">
          <label class="template-picker">
            <span>模板</span>
            <el-select
              :model-value="templateMode"
              size="small"
              popper-class="sml-template-select-popper"
              data-testid="template-select"
              @change="changeTemplate"
            >
              <el-option label="S2F41 · Host Command Send" value="s2f41" />
              <el-option label="空白报文" value="blank" />
            </el-select>
          </label>

          <el-popover placement="bottom-end" :width="300" trigger="click">
            <template #reference>
              <el-button size="small" :icon="Setting">引号设置</el-button>
            </template>
            <div class="quote-settings">
              <div class="quote-settings__title">
                <strong>值包裹方式</strong>
                <span>设置会保存到当前浏览器</span>
              </div>
              <div class="quote-setting-row">
                <span>数值型</span>
                <el-select
                  v-model="quoteSettings.numericQuote"
                  size="small"
                  aria-label="数值型参数引号"
                  :teleported="false"
                  popper-class="sml-quote-select-popper"
                  data-testid="numeric-quote-select"
                >
                  <el-option label="不使用引号" value="none" />
                  <el-option label="双引号 &quot; &quot;" value="double" />
                  <el-option label="单引号 ' '" value="single" />
                </el-select>
              </div>
              <div class="quote-setting-row">
                <span>字符型</span>
                <el-select
                  v-model="quoteSettings.textQuote"
                  size="small"
                  aria-label="字符型参数引号"
                  :teleported="false"
                  popper-class="sml-quote-select-popper"
                  data-testid="text-quote-select"
                >
                  <el-option label="双引号 &quot; &quot;" value="double" />
                  <el-option label="单引号 ' '" value="single" />
                </el-select>
              </div>
              <p>数值型包括 I、U、F 系列；BOOLEAN 与 B 保持原始格式。</p>
            </div>
          </el-popover>

          <el-button size="small" :icon="RefreshLeft" @click="resetDraft">重置</el-button>
          <el-button size="small" type="primary" :icon="DocumentCopy" @click="copySml">复制 SML</el-button>
        </div>

      </header>

      <div class="editor-layout flex-1 min-h-0 overflow-hidden">
        <div class="sml-canvas rounded-xl border border-slate-200 bg-white shadow-sm" data-testid="sml-canvas" @dragover.prevent>
          <div class="sml-ruler" aria-hidden="true"></div>

          <div class="sml-line sml-line--header">
            <span class="line-number">1</span>
            <span class="fold-gutter"></span>
            <div class="code-cell header-code">
              <span class="syntax-keyword">S</span>
              <input
                v-model.number="draft.stream"
                aria-label="Stream"
                class="header-number"
                type="number"
                min="0"
                max="255"
                data-testid="stream-input"
              />
              <span class="syntax-keyword">F</span>
              <input
                v-model.number="draft.function"
                aria-label="Function"
                class="header-number"
                type="number"
                min="0"
                max="255"
                data-testid="function-input"
              />
              <button
                type="button"
                class="wait-bit"
                :class="{ 'wait-bit--active': draft.wait }"
                :aria-pressed="draft.wait"
                @click="draft.wait = !draft.wait"
              >W</button>
            </div>
            <div class="line-comment line-comment--static"><span>//</span> message header</div>
          </div>

          <div
            v-for="(row, index) in canvasRows"
            :key="row.key"
            class="sml-line"
            :class="{
              'sml-line--selected': row.node.id === selectedNodeId,
              'sml-line--close': row.kind === 'close',
              'sml-line--drop-target': dropTargetId === row.node.id && row.kind !== 'close',
              'sml-line--issue': nodeHasIssue(row.node.id)
            }"
            :data-node-id="row.node.id"
            @click="selectNode(row.node.id)"
            @contextmenu.prevent="openContextMenu($event, row.node)"
            @dragenter.prevent="setDropTarget(row)"
            @drop.prevent="dropBefore(row)"
          >
            <span class="line-number">{{ index + 2 }}</span>
            <span class="fold-gutter">
              <button
                v-if="row.kind === 'open'"
                type="button"
                :aria-label="collapsedNodes.has(row.node.id) ? '展开节点' : '折叠节点'"
                @click.stop="toggleNode(row.node.id)"
              >
                <el-icon><ArrowRight v-if="collapsedNodes.has(row.node.id)" /><ArrowDown v-else /></el-icon>
              </button>
            </span>

            <div class="code-cell" :style="{ '--node-depth': row.depth }">
              <template v-if="row.kind === 'close'">
                <span class="syntax-bracket">&gt;{{ row.node.id === draft.root.id ? '.' : '' }}</span>
              </template>

              <template v-else>
                <button
                  type="button"
                  class="drag-handle"
                  :class="{ 'drag-handle--disabled': row.node.id === draft.root.id }"
                  :draggable="row.node.id !== draft.root.id"
                  aria-label="拖动节点排序"
                  @dragstart.stop="startDrag($event, row.node)"
                  @dragend="endDrag"
                >
                  <el-icon><Rank /></el-icon>
                </button>
                <span class="syntax-bracket">&lt;</span>
                <select
                  :value="row.node.type"
                  class="inline-type"
                  :class="typeClass(row.node.type)"
                  :style="{ width: typeSelectWidth(row.node.type) }"
                  :aria-label="`${row.path} 数据类型`"
                  @click.stop
                  @change="changeNodeType(row.node, $event)"
                >
                  <option value="L">L</option>
                  <option v-for="type in SML_VALUE_TYPES" :key="type" :value="type">{{ type }}</option>
                </select>

                <template v-if="row.kind === 'open'">
                  <span class="list-count">[{{ row.node.children.length }}]</span>
                  <span v-if="collapsedNodes.has(row.node.id)" class="fold-summary">… {{ countDescendants(row.node) }} nodes</span>
                </template>

                <template v-else>
                  <label v-if="isTextType(row.node.type)" class="inline-length" @click.stop>
                    <span>[</span>
                    <input
                      :value="row.node.declaredLength ?? ''"
                      type="number"
                      min="0"
                      step="1"
                      placeholder="长度"
                      :aria-label="`${row.path} 字符长度`"
                      @input="changeNodeLength(row.node, $event)"
                      @focus="selectNode(row.node.id)"
                    />
                    <span>]</span>
                  </label>
                  <span v-if="quoteCharacter(row.node.type)" class="syntax-quote">{{ quoteCharacter(row.node.type) }}</span>
                  <input
                    v-model="row.node.value"
                    class="inline-value"
                    :class="{ 'inline-value--text': isTextType(row.node.type) }"
                    :aria-label="`${row.path} 节点值`"
                    :placeholder="valuePlaceholder(row.node.type)"
                    :data-testid="`node-value-${row.node.id}`"
                    @click.stop="selectNode(row.node.id)"
                    @keydown="handleNodeKeydown($event, row.node)"
                  />
                  <span v-if="quoteCharacter(row.node.type)" class="syntax-quote">{{ quoteCharacter(row.node.type) }}</span>
                  <span class="syntax-bracket">&gt;</span>
                </template>
              </template>
            </div>

            <label v-if="row.kind !== 'close'" class="line-comment" @click.stop>
              <span>//</span>
              <input
                v-model="row.node.label"
                :aria-label="`${row.path} 节点名称`"
                placeholder="节点名称"
                @focus="selectNode(row.node.id)"
              />
            </label>
            <span v-else class="line-comment close-label"><span>//</span> {{ row.node.label || 'List' }} end</span>

            <button
              v-if="nodeHasIssue(row.node.id) && row.kind !== 'close'"
              type="button"
              class="issue-marker"
              :title="firstNodeIssue(row.node.id)"
              @click.stop="selectNode(row.node.id)"
            ><el-icon><WarningFilled /></el-icon></button>
          </div>
        </div>

        <aside class="source-panel overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" aria-label="SML 源码">
          <header>
            <div>
              <span>SOURCE</span>
              <strong>SML 源码</strong>
            </div>
            <span class="source-status" :class="`source-status--${sourceSyncState}`">
              <i></i>{{ sourceStatusText }}
            </span>
          </header>

          <div class="source-editor">
            <el-input
              :model-value="sourceText"
              type="textarea"
              resize="none"
              aria-label="SML 源码"
              class="source-input"
              data-testid="sml-source-input"
              spellcheck="false"
              @input="handleSourceInput"
              @blur="applySourceSml"
            />
            <div v-if="sourceSyncState === 'error'" class="source-error" role="alert">
              <el-icon><WarningFilled /></el-icon>
              <span>{{ sourceSyncMessage }}</span>
            </div>
          </div>

          <footer>
            <span>移出焦点后格式化并应用</span>
            <span>{{ sourceText.split('\n').length }} lines</span>
          </footer>
        </aside>

        <aside class="diagnostics-panel overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" aria-label="结构检查">
          <div class="selected-node-card">
            <span>CURRENT NODE</span>
            <div>
              <code>{{ selectedPath }}</code>
              <strong>{{ selectedNode.label || selectedNode.type }}</strong>
              <b :class="typeClass(selectedNode.type)">{{ selectedNode.type }}</b>
            </div>
          </div>
          <header>
            <div>
              <span>STRUCTURE</span>
              <strong>结构检查</strong>
            </div>
            <button
              type="button"
              class="validation-summary"
              :class="errorCount ? 'validation-summary--error' : warningCount ? 'validation-summary--warning' : 'validation-summary--valid'"
              @click="focusFirstIssue"
            >
              <el-icon><CircleCheckFilled v-if="!issues.length" /><WarningFilled v-else /></el-icon>
              <span v-if="!issues.length">结构有效 · {{ nodeCount }} 个节点</span>
              <span v-else>{{ errorCount }} 个错误 · {{ warningCount }} 个提醒</span>
            </button>
          </header>

          <div class="diagnostics-content">
            <div v-if="!issues.length" class="all-valid">
              <el-icon><CircleCheckFilled /></el-icon>
              <strong>当前 SML 结构有效</strong>
              <p>List 数量会随结构修改自动更新。</p>
            </div>

            <div v-else class="issue-list">
              <button
                v-for="(issue, index) in issues"
                :key="`${issue.message}-${index}`"
                type="button"
                :class="`issue-item--${issue.severity}`"
                @click="issue.nodeId && selectNode(issue.nodeId)"
              >
                <el-icon><WarningFilled /></el-icon>
                <span>
                  <strong>{{ issue.severity === 'error' ? '错误' : '提醒' }}</strong>
                  {{ issue.message }}
                </span>
              </button>
            </div>

            <div class="structure-summary">
              <div><span>节点</span><strong>{{ nodeCount }}</strong></div>
              <div><span>深度</span><strong>{{ maxDepth }}</strong></div>
              <div><span>List</span><strong>{{ listCount }}</strong></div>
            </div>

            <div class="interaction-help">
              <strong>直接操作</strong>
              <ul>
                <li>点击类型名称可切换数据类型</li>
                <li>拖动左侧手柄可调整同级顺序</li>
                <li><b>右键节点</b>添加、复制或删除</li>
                <li>右键菜单可改变节点层级</li>
              </ul>
            </div>
          </div>

          <footer>
            <span>{{ smlText.split('\n').length }} lines</span>
            <span>2 spaces · SEMI E5</span>
          </footer>
        </aside>
      </div>
    </section>

    <Teleport to="body">
      <div
        v-if="contextMenu.open"
        class="sml-context-menu"
        :style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }"
        role="menu"
        aria-label="节点操作"
        @click.stop
        @contextmenu.prevent
      >
        <div class="context-menu__header">
          <span>{{ selectedPath }}</span>
          <strong>{{ selectedNode.label || selectedNode.type }}</strong>
        </div>
        <button type="button" role="menuitem" :disabled="selectedNode.type !== 'L'" @click="runContextAction('child')">
          <el-icon><FolderAdd /></el-icon><span>添加子节点</span>
        </button>
        <button type="button" role="menuitem" :disabled="isRootSelected" @click="runContextAction('sibling')">
          <el-icon><Plus /></el-icon><span>添加同级节点</span>
        </button>
        <button type="button" role="menuitem" :disabled="isRootSelected" @click="runContextAction('wrap')">
          <el-icon><Box /></el-icon><span>包装为 List</span>
        </button>
        <div class="context-menu__separator"></div>
        <button type="button" role="menuitem" :disabled="!canIndent" @click="runContextAction('indent')">
          <el-icon><DArrowRight /></el-icon><span>缩进到上一 List</span>
        </button>
        <button type="button" role="menuitem" :disabled="!canOutdent" @click="runContextAction('outdent')">
          <el-icon><DArrowLeft /></el-icon><span>取消缩进</span>
        </button>
        <button type="button" role="menuitem" :disabled="!canMoveSelected(-1)" @click="runContextAction('up')">
          <el-icon><Top /></el-icon><span>上移</span><kbd>Alt ↑</kbd>
        </button>
        <button type="button" role="menuitem" :disabled="!canMoveSelected(1)" @click="runContextAction('down')">
          <el-icon><Bottom /></el-icon><span>下移</span><kbd>Alt ↓</kbd>
        </button>
        <button v-if="selectedNode.type === 'L'" type="button" role="menuitem" @click="runContextAction('fold')">
          <el-icon><ArrowRight /></el-icon><span>{{ collapsedNodes.has(selectedNode.id) ? '展开 List' : '折叠 List' }}</span>
        </button>
        <div class="context-menu__separator"></div>
        <button type="button" role="menuitem" :disabled="isRootSelected" @click="runContextAction('duplicate')">
          <el-icon><CopyDocument /></el-icon><span>复制节点</span><kbd>Ctrl D</kbd>
        </button>
        <button type="button" role="menuitem" class="context-menu__danger" :disabled="isRootSelected" @click="runContextAction('delete')">
          <el-icon><Delete /></el-icon><span>删除节点</span>
        </button>
      </div>
    </Teleport>

  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  ArrowDown,
  ArrowRight,
  Bottom,
  Box,
  CircleCheckFilled,
  CopyDocument,
  DArrowLeft,
  DArrowRight,
  Delete,
  DocumentCopy,
  FolderAdd,
  Plus,
  Rank,
  RefreshLeft,
  SetUp,
  Setting,
  Top,
  WarningFilled
} from '@element-plus/icons-vue'
import { formatSmlDiagnostic, parseSmlTree, type SecsSmlNode } from './secsSml'
import {
  DEFAULT_SML_QUOTE_SETTINGS,
  SML_VALUE_TYPES,
  cloneNode,
  countNodes,
  createBlankDraft,
  createNode,
  createS2F41Draft,
  findNode,
  findParent,
  formatSmlDraftForCopy,
  getNodePath,
  getNodeQuoteStyle,
  serializeSmlDraft,
  validateSmlDraft,
  type SmlBuilderNode,
  type SmlBuilderType,
  type SmlMessageDraft,
  type SmlQuoteSettings,
  type SmlValueType
} from './smlBuilder'

type TemplateMode = 's2f41' | 'blank'
type CanvasRowKind = 'open' | 'value' | 'close'
type SourceSyncState = 'synced' | 'editing' | 'error'

interface CanvasRow {
  key: string
  node: SmlBuilderNode
  depth: number
  path: string
  kind: CanvasRowKind
}

type ContextAction = 'child' | 'sibling' | 'wrap' | 'indent' | 'outdent' | 'up' | 'down' | 'fold' | 'duplicate' | 'delete'

const QUOTE_SETTINGS_STORAGE_KEY = 'secs-tools:sml-builder:quote-settings'

function loadQuoteSettings(): SmlQuoteSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(QUOTE_SETTINGS_STORAGE_KEY) || '{}') as Partial<SmlQuoteSettings>
    return {
      numericQuote: ['none', 'double', 'single'].includes(saved.numericQuote || '')
        ? saved.numericQuote as SmlQuoteSettings['numericQuote']
        : DEFAULT_SML_QUOTE_SETTINGS.numericQuote,
      textQuote: ['double', 'single'].includes(saved.textQuote || '')
        ? saved.textQuote as SmlQuoteSettings['textQuote']
        : DEFAULT_SML_QUOTE_SETTINGS.textQuote
    }
  } catch {
    return { ...DEFAULT_SML_QUOTE_SETTINGS }
  }
}

const templateMode = ref<TemplateMode>('s2f41')
const pageRoot = ref<HTMLDivElement | null>(null)
const draft = reactive<SmlMessageDraft>(createS2F41Draft())
const selectedNodeId = ref(draft.root.children[0]?.id || draft.root.id)
const collapsedNodes = ref(new Set<string>())
const draggedNodeId = ref('')
const dropTargetId = ref('')
const quoteSettings = reactive<SmlQuoteSettings>(loadQuoteSettings())
const contextMenu = reactive({ open: false, x: 0, y: 0 })

const selectedNode = computed(() => findNode(draft.root, selectedNodeId.value) || draft.root)
const selectedPath = computed(() => getNodePath(draft.root, selectedNode.value.id))
const isRootSelected = computed(() => selectedNode.value.id === draft.root.id)
const nodeCount = computed(() => countNodes(draft.root))
const smlText = computed(() => serializeSmlDraft(draft, quoteSettings))
const formattedSmlText = computed(() => formatSmlDraftForCopy(draft, quoteSettings).text)
const sourceText = ref(formattedSmlText.value)
const sourceSyncState = ref<SourceSyncState>('synced')
const sourceSyncMessage = ref('')
const sourceStatusText = computed(() => {
  if (sourceSyncState.value === 'editing') return '等待同步'
  if (sourceSyncState.value === 'error') return '解析失败'
  return '已同步'
})
const issues = computed(() => validateSmlDraft(draft, templateMode.value))
const errorCount = computed(() => issues.value.filter(issue => issue.severity === 'error').length)
const warningCount = computed(() => issues.value.filter(issue => issue.severity === 'warning').length)
let mainContentElement: HTMLElement | null = null
let previousMainPadding = ''
let previousMainPaddingVariable = ''

const canvasRows = computed<CanvasRow[]>(() => {
  const rows: CanvasRow[] = []
  function walk(node: SmlBuilderNode, depth: number, path: number[]) {
    const pathText = path.map(index => `[${index}]`).join('')
    if (node.type === 'L') {
      rows.push({ key: `${node.id}-open`, node, depth, path: pathText, kind: 'open' })
      if (!collapsedNodes.value.has(node.id)) {
        node.children.forEach((child, index) => walk(child, depth + 1, path.concat(index)))
      }
      rows.push({ key: `${node.id}-close`, node, depth, path: pathText, kind: 'close' })
    } else {
      rows.push({ key: `${node.id}-value`, node, depth, path: pathText, kind: 'value' })
    }
  }
  walk(draft.root, 0, [0])
  return rows
})

const canIndent = computed(() => {
  const parent = findParent(draft.root, selectedNode.value.id)
  if (!parent) return false
  const index = parent.children.findIndex(child => child.id === selectedNode.value.id)
  return index > 0 && parent.children[index - 1]?.type === 'L'
})

const canOutdent = computed(() => {
  const parent = findParent(draft.root, selectedNode.value.id)
  return Boolean(parent && findParent(draft.root, parent.id))
})

const listCount = computed(() => {
  let count = 0
  walkNodes(draft.root, node => { if (node.type === 'L') count += 1 })
  return count
})

const maxDepth = computed(() => {
  function measure(node: SmlBuilderNode, depth: number): number {
    return Math.max(depth, ...node.children.map(child => measure(child, depth + 1)))
  }
  return measure(draft.root, 1)
})

function walkNodes(node: SmlBuilderNode, visitor: (node: SmlBuilderNode) => void) {
  visitor(node)
  node.children.forEach(child => walkNodes(child, visitor))
}

function replaceDraft(nextDraft: SmlMessageDraft) {
  draft.stream = nextDraft.stream
  draft.function = nextDraft.function
  draft.wait = nextDraft.wait
  draft.root = nextDraft.root
  selectedNodeId.value = nextDraft.root.children[0]?.id || nextDraft.root.id
  collapsedNodes.value = new Set()
}

async function changeTemplate(value: unknown) {
  const nextMode = String(value) as TemplateMode
  if (nextMode === templateMode.value) return
  try {
    await ElMessageBox.confirm('切换模板会替换当前 SML。', '切换初始模板', {
      confirmButtonText: '切换', cancelButtonText: '保留当前内容', type: 'warning'
    })
    templateMode.value = nextMode
    replaceDraft(nextMode === 's2f41' ? createS2F41Draft() : createBlankDraft())
  } catch {
    // Keep the current SML.
  }
}

async function resetDraft() {
  try {
    await ElMessageBox.confirm('重置会放弃当前修改。', '重置 SML', {
      confirmButtonText: '重置', cancelButtonText: '取消', type: 'warning'
    })
    replaceDraft(templateMode.value === 's2f41' ? createS2F41Draft() : createBlankDraft())
    ElMessage.success('已重置 SML')
  } catch {
    // Keep the current SML.
  }
}

function selectNode(id: string) {
  selectedNodeId.value = id
}

function openContextMenu(event: MouseEvent, node: SmlBuilderNode) {
  selectNode(node.id)
  contextMenu.x = Math.max(8, Math.min(event.clientX, window.innerWidth - 224))
  contextMenu.y = Math.max(8, Math.min(event.clientY, window.innerHeight - 390))
  contextMenu.open = true
}

function closeContextMenu() {
  contextMenu.open = false
}

function runContextAction(action: ContextAction) {
  if (action === 'child') addChild()
  else if (action === 'sibling') addSibling()
  else if (action === 'wrap') wrapSelected()
  else if (action === 'indent') indentSelected()
  else if (action === 'outdent') outdentSelected()
  else if (action === 'up') moveSelected(-1)
  else if (action === 'down') moveSelected(1)
  else if (action === 'fold') toggleNode(selectedNode.value.id)
  else if (action === 'duplicate') duplicateSelected()
  else if (action === 'delete') deleteSelected()
  closeContextMenu()
}

function toggleNode(id: string) {
  const next = new Set(collapsedNodes.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  collapsedNodes.value = next
}

function getParentInfo(nodeId: string) {
  const parent = findParent(draft.root, nodeId)
  if (!parent) return undefined
  return { parent, index: parent.children.findIndex(child => child.id === nodeId) }
}

function addChild() {
  if (selectedNode.value.type !== 'L') return
  const child = createNode('A', 'New item')
  selectedNode.value.children.push(child)
  const next = new Set(collapsedNodes.value)
  next.delete(selectedNode.value.id)
  collapsedNodes.value = next
  selectedNodeId.value = child.id
}

function addSibling() {
  const info = getParentInfo(selectedNode.value.id)
  if (!info) return
  const sibling = createNode('A', 'New item')
  info.parent.children.splice(info.index + 1, 0, sibling)
  selectedNodeId.value = sibling.id
}

function wrapSelected() {
  const info = getParentInfo(selectedNode.value.id)
  if (!info) return
  const wrapper = createNode('L', `${selectedNode.value.label || selectedNode.value.type} group`, '', [selectedNode.value])
  info.parent.children.splice(info.index, 1, wrapper)
  selectedNodeId.value = wrapper.id
}

function indentSelected() {
  const info = getParentInfo(selectedNode.value.id)
  if (!info || info.index < 1) return
  const target = info.parent.children[info.index - 1]
  if (!target || target.type !== 'L') return
  const [node] = info.parent.children.splice(info.index, 1)
  if (!node) return
  target.children.push(node)
  const next = new Set(collapsedNodes.value)
  next.delete(target.id)
  collapsedNodes.value = next
}

function outdentSelected() {
  const parent = findParent(draft.root, selectedNode.value.id)
  if (!parent) return
  const grandParent = findParent(draft.root, parent.id)
  if (!grandParent) return
  const nodeIndex = parent.children.findIndex(child => child.id === selectedNode.value.id)
  const parentIndex = grandParent.children.findIndex(child => child.id === parent.id)
  const [node] = parent.children.splice(nodeIndex, 1)
  if (node) grandParent.children.splice(parentIndex + 1, 0, node)
}

function duplicateSelected() {
  const info = getParentInfo(selectedNode.value.id)
  if (!info) return
  const copy = cloneNode(selectedNode.value)
  info.parent.children.splice(info.index + 1, 0, copy)
  selectedNodeId.value = copy.id
}

function deleteSelected() {
  const info = getParentInfo(selectedNode.value.id)
  if (!info) return
  info.parent.children.splice(info.index, 1)
  selectedNodeId.value = info.parent.id
}

function canMoveSelected(direction: -1 | 1) {
  const info = getParentInfo(selectedNode.value.id)
  if (!info) return false
  const targetIndex = info.index + direction
  return targetIndex >= 0 && targetIndex < info.parent.children.length
}

function moveSelected(direction: -1 | 1) {
  const info = getParentInfo(selectedNode.value.id)
  if (!info) return
  const targetIndex = info.index + direction
  if (targetIndex < 0 || targetIndex >= info.parent.children.length) return
  const [node] = info.parent.children.splice(info.index, 1)
  if (node) info.parent.children.splice(targetIndex, 0, node)
}

async function setNodeType(node: SmlBuilderNode, type: SmlBuilderType) {
  if (type === node.type) return
  if (node.type === 'L' && type !== 'L' && node.children.length) {
    try {
      await ElMessageBox.confirm('切换为数据类型会移除当前 List 的全部子节点。', '更改节点类型', {
        confirmButtonText: '更改', cancelButtonText: '取消', type: 'warning'
      })
    } catch {
      return
    }
  }
  node.type = type
  node.value = ''
  node.declaredLength = null
  node.children = []
  selectedNodeId.value = node.id
}

function changeNodeType(node: SmlBuilderNode, event: Event) {
  const select = event.target as HTMLSelectElement
  const nextType = select.value as SmlBuilderType
  void setNodeType(node, nextType).finally(() => { select.value = node.type })
}

function changeNodeLength(node: SmlBuilderNode, event: Event) {
  const input = event.target as HTMLInputElement
  node.declaredLength = input.value === '' ? null : Number(input.value)
  selectedNodeId.value = node.id
}

function handleNodeKeydown(event: KeyboardEvent, node: SmlBuilderNode) {
  selectNode(node.id)
  if (event.altKey && event.key === 'ArrowUp') {
    event.preventDefault()
    moveSelected(-1)
  } else if (event.altKey && event.key === 'ArrowDown') {
    event.preventDefault()
    moveSelected(1)
  }
}

function startDrag(event: DragEvent, node: SmlBuilderNode) {
  if (node.id === draft.root.id) {
    event.preventDefault()
    return
  }
  draggedNodeId.value = node.id
  event.dataTransfer?.setData('text/plain', node.id)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}

function endDrag() {
  draggedNodeId.value = ''
  dropTargetId.value = ''
}

function setDropTarget(row: CanvasRow) {
  if (!draggedNodeId.value || row.kind === 'close' || row.node.id === draft.root.id) return
  const source = findNode(draft.root, draggedNodeId.value)
  if (!source || source.id === row.node.id || findNode(source, row.node.id)) return
  dropTargetId.value = row.node.id
}

function dropBefore(row: CanvasRow) {
  const sourceId = draggedNodeId.value
  dropTargetId.value = ''
  if (!sourceId || row.kind === 'close' || row.node.id === draft.root.id) return
  const source = findNode(draft.root, sourceId)
  if (!source || source.id === row.node.id || findNode(source, row.node.id)) return
  const sourceInfo = getParentInfo(sourceId)
  const targetInfo = getParentInfo(row.node.id)
  if (!sourceInfo || !targetInfo) return
  sourceInfo.parent.children.splice(sourceInfo.index, 1)
  const refreshedTargetIndex = targetInfo.parent.children.findIndex(child => child.id === row.node.id)
  targetInfo.parent.children.splice(refreshedTargetIndex, 0, source)
  selectedNodeId.value = source.id
  draggedNodeId.value = ''
}

function nodeHasIssue(id: string) {
  return issues.value.some(issue => issue.nodeId === id)
}

function firstNodeIssue(id: string) {
  return issues.value.find(issue => issue.nodeId === id)?.message || ''
}

function focusFirstIssue() {
  const issue = issues.value.find(item => item.nodeId)
  if (issue?.nodeId) selectedNodeId.value = issue.nodeId
}

function countDescendants(node: SmlBuilderNode) {
  return Math.max(0, countNodes(node) - 1)
}

function isTextType(type: SmlBuilderType) {
  return type === 'A' || type === 'JIS8'
}

function quoteCharacter(type: SmlBuilderType) {
  const style = getNodeQuoteStyle(type, quoteSettings)
  if (style === 'single') return "'"
  if (style === 'double') return '"'
  return ''
}

function typeClass(type: SmlBuilderType) {
  if (type === 'L') return 'inline-type--list'
  if (isTextType(type)) return 'inline-type--text'
  if (/^[IU]/.test(type)) return 'inline-type--integer'
  if (/^F/.test(type)) return 'inline-type--float'
  if (type === 'BOOLEAN') return 'inline-type--boolean'
  return 'inline-type--binary'
}

function typeSelectWidth(type: SmlBuilderType) {
  return `${Math.max(48, type.length * 7 + 30)}px`
}

function valuePlaceholder(type: SmlBuilderType) {
  if (isTextType(type)) return 'text'
  if (type === 'BOOLEAN') return 'TRUE / FALSE'
  if (type === 'B') return '0x01 0xFF'
  return 'value'
}

async function copySml() {
  try {
    await navigator.clipboard.writeText(formattedSmlText.value)
    ElMessage.success('已复制格式化后的 SML')
  } catch {
    ElMessage.error('复制失败，请重试')
  }
}

function normalizeImportedType(typeName = ''): SmlBuilderType {
  const normalized = typeName.toUpperCase()
  const aliases: Record<string, SmlBuilderType> = {
    LIST: 'L', ASCII: 'A', BINARY: 'B', BOOL: 'BOOLEAN', J: 'JIS8',
    INT8: 'I1', INT16: 'I2', INT32: 'I4', INT64: 'I8',
    UINT8: 'U1', UINT16: 'U2', UINT32: 'U4', UINT64: 'U8',
    FLOAT32: 'F4', FLOAT64: 'F8'
  }
  if (aliases[normalized]) return aliases[normalized]
  if (normalized === 'L' || SML_VALUE_TYPES.includes(normalized as SmlValueType)) return normalized as SmlBuilderType
  return 'A'
}

function decodeImportedValue(node: SecsSmlNode) {
  const raw = node.values?.join(' ') || ''
  if (raw.length >= 2) {
    const quote = raw[0]
    if ((quote === '"' || quote === "'") && raw[raw.length - 1] === quote) {
      const escapedQuote = quote === '"' ? /\\"/g : /\\'/g
      return raw.slice(1, -1).replace(escapedQuote, quote).replace(/\\\\/g, '\\')
    }
  }
  return raw
}

function convertImportedNode(node: SecsSmlNode): SmlBuilderNode {
  const type = normalizeImportedType(node.typeName)
  if (type === 'L') return createNode('L', node.label || '', '', node.children.map(convertImportedNode))
  const declaredLength = isTextType(type) && node.declaredCount !== undefined ? node.declaredCount : null
  return createNode(type, node.label || '', decodeImportedValue(node), [], declaredLength)
}

function inferS2F41Labels(root: SmlBuilderNode) {
  root.label = 'S2F41 Body'
  const [rcmd, parameterList] = root.children
  if (rcmd) rcmd.label = 'RCMD'
  if (parameterList?.type !== 'L') return
  parameterList.label = 'Command Parameters'
  parameterList.children.forEach(pair => {
    if (pair.type !== 'L') return
    const [name, value] = pair.children
    pair.label = name?.value || 'Command Parameter'
    if (name) name.label = 'CPNAME'
    if (value) value.label = 'CPVAL'
  })
}

function applySourceSml() {
  const parsed = parseSmlTree(sourceText.value, { mode: 'strict' })
  const errors = parsed.diagnostics.filter(item => item.severity === 'error')
  if (!parsed.roots[0] || parsed.roots.length !== 1 || errors.length) {
    sourceSyncState.value = 'error'
    sourceSyncMessage.value = errors[0]
      ? formatSmlDiagnostic(errors[0])
      : parsed.roots.length > 1
        ? '当前构造器一次只能编辑一个 SML 根节点'
        : '没有找到可应用的 SML 根节点'
    return
  }
  const headerMatch = parsed.header.match(/^S(\d+)F(\d+)(?:\s+(W))?$/i)
  const nextDraft: SmlMessageDraft = {
    stream: headerMatch ? Number(headerMatch[1]) : draft.stream,
    function: headerMatch ? Number(headerMatch[2]) : draft.function,
    wait: Boolean(headerMatch?.[3]),
    root: convertImportedNode(parsed.roots[0])
  }
  const isS2F41 = nextDraft.stream === 2 && nextDraft.function === 41
  templateMode.value = isS2F41 ? 's2f41' : 'blank'
  if (isS2F41) inferS2F41Labels(nextDraft.root)
  replaceDraft(nextDraft)
  sourceText.value = formatSmlDraftForCopy(nextDraft, quoteSettings).text
  sourceSyncState.value = 'synced'
  sourceSyncMessage.value = ''
}

function handleSourceInput(value: string) {
  sourceText.value = value
  sourceSyncState.value = 'editing'
  sourceSyncMessage.value = ''
}

watch(formattedSmlText, value => {
  sourceText.value = value
  sourceSyncState.value = 'synced'
  sourceSyncMessage.value = ''
})

watch(quoteSettings, value => {
  try {
    localStorage.setItem(QUOTE_SETTINGS_STORAGE_KEY, JSON.stringify(value))
  } catch {
    // Storage can be unavailable in private or restricted browser contexts.
  }
}, { deep: true })

function handleWindowKeydown(event: KeyboardEvent) {
  if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'd') {
    event.preventDefault()
    event.stopPropagation()
    if (event.target instanceof Element && event.target.closest('.source-panel')) return
    if (!isRootSelected.value) duplicateSelected()
    closeContextMenu()
    return
  }
  if (event.key === 'Escape') closeContextMenu()
}

function applyPagePadding() {
  const nextMainElement = pageRoot.value?.closest('.el-main')
  if (!(nextMainElement instanceof HTMLElement)) return
  mainContentElement = nextMainElement
  previousMainPadding = nextMainElement.style.padding
  previousMainPaddingVariable = nextMainElement.style.getPropertyValue('--el-main-padding')
  nextMainElement.style.padding = '10px'
  nextMainElement.style.setProperty('--el-main-padding', '10px')
}

function restorePagePadding() {
  if (!mainContentElement) return
  mainContentElement.style.padding = previousMainPadding
  if (previousMainPaddingVariable) {
    mainContentElement.style.setProperty('--el-main-padding', previousMainPaddingVariable)
  } else {
    mainContentElement.style.removeProperty('--el-main-padding')
  }
  mainContentElement = null
}

onMounted(() => {
  applyPagePadding()
  window.addEventListener('click', closeContextMenu)
  window.addEventListener('keydown', handleWindowKeydown, true)
  window.addEventListener('scroll', closeContextMenu, true)
})

onUnmounted(() => {
  restorePagePadding()
  window.removeEventListener('click', closeContextMenu)
  window.removeEventListener('keydown', handleWindowKeydown, true)
  window.removeEventListener('scroll', closeContextMenu, true)
})
</script>

<style scoped>
.sml-builder-page {
  --ink: #172033;
  --muted: #64748b;
  --line: #dbe4ee;
  --accent: #087f8c;
  --accent-soft: #eaf8f8;
  color: var(--ink);
}

.editor-shell { height: 100%; }

.editor-brand,
.header-actions,
.validation-summary,
.source-panel header,
.diagnostics-panel header,
.structure-summary {
  display: flex;
  align-items: center;
}

.editor-header { display: grid; grid-template-columns: minmax(180px, 1fr) auto; align-items: center; gap: 8px 18px; padding: 8px 12px; background: #f8fafc; }
.editor-brand { min-width: 0; gap: 9px; }
.editor-brand__icon { width: 32px; height: 32px; display: grid; flex: 0 0 auto; place-items: center; border: 1px solid #bfe4e5; border-radius: 7px; background: var(--accent-soft); color: var(--accent); font-size: 16px; }
.editor-brand > div:last-child { min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.editor-brand h2 { margin: 0; color: #1e293b; font-size: 15px; font-weight: 700; letter-spacing: -0.01em; }
.editor-brand small { color: #7b8a9d; font-size: 9px; }
.header-actions { flex-wrap: wrap; justify-content: flex-end; gap: 6px; }
.template-picker { display: flex; align-items: center; gap: 6px; color: var(--muted); font-size: 11px; white-space: nowrap; }
.template-picker :deep(.el-select) {
  width: 202px;
  /* The template list is tiny. Avoid a composited transition whose presentation
     cost can be amplified dramatically by some Windows GPU/DevTools setups. */
  --el-transition-duration: 0s;
  --el-transition-duration-fast: 0s;
}
.template-picker :deep(.el-select__wrapper),
.template-picker :deep(.el-select__caret) { transition-duration: 0s; }
:global(.sml-template-select-popper.el-select__popper) {
  --el-transition-duration: 0s;
  --el-transition-duration-fast: 0s;
  contain: layout;
}
:global(.sml-template-select-popper.el-zoom-in-top-enter-active),
:global(.sml-template-select-popper.el-zoom-in-top-leave-active) {
  transition-duration: 0s !important;
}
.validation-summary { flex: 0 0 auto; gap: 6px; padding: 5px 8px; border: 1px solid; border-radius: 5px; font-size: 9px; cursor: pointer; }
.validation-summary--valid { border-color: #bbdfd3; color: #08765d; background: #f1faf7; }
.validation-summary--warning { border-color: #f4d69d; color: #99620b; background: #fffbeb; }
.validation-summary--error { border-color: #fecaca; color: #b4232d; background: #fff6f6; }

.editor-layout { display: grid; grid-template-columns: minmax(0, 1fr) minmax(320px, 0.48fr) 260px; gap: 8px; }
.sml-canvas { position: relative; min-width: 0; overflow: auto; padding: 5px 0 18px; background: #fbfcfe; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
.sml-ruler { position: absolute; inset: 0; pointer-events: none; background-image: linear-gradient(to right, transparent 0, transparent 61px, #edf1f5 62px, transparent 63px); }
.sml-line { position: relative; min-width: 760px; min-height: 27px; display: grid; grid-template-columns: 38px 23px minmax(400px, 1fr) minmax(120px, 200px) 24px; align-items: center; border-left: 2px solid transparent; color: #334155; }
.sml-line:hover { background: #f3f6f9; }
.sml-line--selected { border-left-color: var(--accent); background: #edf8f8 !important; }
.sml-line--issue { box-shadow: inset 3px 0 #d95b65; }
.sml-line--close { min-height: 23px; }
.sml-line--drop-target::before { position: absolute; z-index: 4; top: -1px; right: 12px; left: 61px; height: 2px; background: #1ba3aa; content: ''; }
.sml-line--header { min-height: 29px; grid-template-columns: 38px 23px minmax(400px, 1fr) minmax(120px, 200px) 24px; border-bottom: 1px solid #e7ecf2; background: #f6f8fb; }
.line-number { padding-right: 3px; color: #a0acba; font-size: 8px; text-align: right; user-select: none; }
.fold-gutter { display: grid; place-items: center; }
.fold-gutter button { width: 20px; height: 20px; display: grid; place-items: center; border: 0; border-radius: 3px; background: transparent; color: #74859a; cursor: pointer; }
.fold-gutter button:hover { background: #e4eaf0; color: #334155; }
.code-cell { position: relative; min-width: 0; height: 27px; display: flex; align-items: center; gap: 3px; padding-left: calc(var(--node-depth) * 22px); }
.sml-line:not(.sml-line--header) .code-cell::before { position: absolute; z-index: 0; top: 0; bottom: 0; left: 0; width: calc(var(--node-depth) * 22px); background-image: repeating-linear-gradient(to right, transparent 0 10px, #d8e2ec 10px 11px, transparent 11px 22px); content: ''; pointer-events: none; }
.code-cell > * { position: relative; z-index: 1; }
.sml-line--close .code-cell { height: 23px; }
.header-code { gap: 0; padding-left: 5px; }
.syntax-keyword { color: #087f8c; font-size: 12px; font-weight: 700; }
.header-number { width: 29px; padding: 1px; border: 0; border-bottom: 1px solid #9bc9cc; outline: 0; background: transparent; color: #1e4560; font: 700 12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; text-align: center; appearance: textfield; }
.header-number::-webkit-inner-spin-button { appearance: none; }
.header-number:focus { border-color: var(--accent); background: #fff; }
.wait-bit { margin-left: 7px; padding: 2px 5px; border: 1px solid #ccd7e2; border-radius: 4px; background: #fff; color: #94a3b8; font: 700 9px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; cursor: pointer; }
.wait-bit--active { border-color: #80c5c8; background: var(--accent-soft); color: var(--accent); }
.drag-handle { width: 16px; height: 21px; display: grid; flex: 0 0 auto; place-items: center; margin-left: -17px; border: 0; background: transparent; color: transparent; cursor: grab; }
.sml-line:hover .drag-handle, .sml-line--selected .drag-handle { color: #93a2b5; }
.drag-handle--disabled { visibility: hidden; }
.syntax-bracket { color: #718197; font-size: 11px; }
.syntax-quote { color: #a66c2c; font-size: 11px; font-weight: 700; }
.inline-type { min-width: 0; max-width: none; height: 20px; flex: 0 0 auto; padding: 0 14px 0 4px; border: 1px solid; border-radius: 4px; outline: 0; font: 700 9px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; cursor: pointer; }
.inline-type:hover, .inline-type:focus { filter: saturate(1.2) brightness(0.98); }
.inline-type--list { border-color: #89cbd0; background: #e8f8f8; color: #087985; }
.inline-type--text { border-color: #e7c686; background: #fff8e8; color: #96631b; }
.inline-type--integer { border-color: #9cc4e8; background: #edf6ff; color: #216b9f; }
.inline-type--float { border-color: #c8afe6; background: #f6f0fc; color: #7650a1; }
.inline-type--boolean { border-color: #9dceb5; background: #eff9f3; color: #287451; }
.inline-type--binary { border-color: #bcc8d5; background: #f2f5f8; color: #526276; }
.inline-length { height: 20px; display: inline-flex; align-items: center; gap: 1px; color: #9a6a22; font-size: 9px; }
.inline-length input { width: 38px; height: 18px; padding: 0 2px; border: 0; border-bottom: 1px dashed #d2ad70; outline: 0; background: transparent; color: #8b5b16; font: 9px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; text-align: center; appearance: textfield; }
.inline-length input::-webkit-inner-spin-button { appearance: none; }
.inline-length input:focus { border-bottom-style: solid; border-color: #b07a2a; background: #fffaf0; }
.inline-length input::placeholder { color: #c2a77e; }
.list-count { margin-left: 2px; color: #79509a; font-size: 10px; font-weight: 700; }
.fold-summary { margin-left: 7px; color: #91a0b3; font-size: 9px; }
.inline-value { width: clamp(140px, 28vw, 390px); min-width: 90px; max-width: 390px; flex: 0 1 390px; padding: 2px 4px; border: 1px solid transparent; border-radius: 3px; outline: 0; background: transparent; color: #6f542b; font: 10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
.inline-value:hover { border-color: #d8e2eb; background: #fff; }
.inline-value:focus { border-color: #79bfc3; background: #fff; box-shadow: 0 0 0 2px rgb(8 127 140 / 0.08); }
.line-comment { min-width: 0; display: flex; align-items: center; gap: 4px; color: #98a5b5; font: 8px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
.line-comment > span { color: #b4bdc9; }
.line-comment input { min-width: 0; width: 100%; padding: 2px 3px; border: 1px solid transparent; border-radius: 3px; outline: 0; background: transparent; color: #8190a4; font: 8px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
.line-comment input:hover, .line-comment input:focus { border-color: #d8e2eb; background: #fff; }
.line-comment--static { grid-column: 4; }
.close-label { white-space: nowrap; }
.issue-marker { width: 20px; height: 20px; display: grid; place-items: center; border: 0; background: transparent; color: #cf505b; cursor: pointer; }

.source-panel,
.diagnostics-panel { min-width: 0; display: flex; flex-direction: column; background: #fff; }
.source-panel header { min-height: 49px; justify-content: space-between; gap: 10px; padding: 8px 10px; border-bottom: 1px solid var(--line); background: #f8fafc; }
.source-panel header > div { display: flex; flex-direction: column; gap: 1px; }
.source-panel header div span { color: #8b99ab; font: 8px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; letter-spacing: 0.08em; }
.source-panel header strong { color: #475569; font-size: 12px; }
.source-status { display: inline-flex; align-items: center; gap: 5px; color: #64748b; font-size: 9px; white-space: nowrap; }
.source-status i { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.source-status--synced { color: #168066; }
.source-status--editing { color: #a36a0a; }
.source-status--error { color: #c2414c; }
.source-editor { position: relative; min-height: 0; flex: 1; padding: 7px; background: #f8fafc; }
.source-input { height: 100%; }
.source-input :deep(.el-textarea__inner) { height: 100%; padding: 9px 10px; resize: none; border: 0; border-radius: 5px; box-shadow: inset 0 0 0 1px #dbe4ee; background: #fff; color: #314155; font: 10px/1.55 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; tab-size: 4; white-space: pre; }
.source-input :deep(.el-textarea__inner:focus) { box-shadow: inset 0 0 0 1px #69b7bc, 0 0 0 2px rgb(8 127 140 / 0.07); }
.source-error { position: absolute; right: 13px; bottom: 13px; left: 13px; max-height: 86px; display: flex; align-items: flex-start; gap: 6px; overflow: auto; padding: 7px 8px; border: 1px solid #fecaca; border-radius: 5px; background: rgb(255 247 247 / 0.96); box-shadow: 0 4px 12px rgb(90 24 31 / 0.08); color: #b4232d; font-size: 9px; line-height: 1.45; }
.source-error .el-icon { flex: 0 0 auto; margin-top: 1px; }
.source-panel footer { min-height: 34px; display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 0 9px; border-top: 1px solid var(--line); color: #8a98a9; font: 8px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
.selected-node-card { padding: 9px 10px; border-bottom: 1px solid var(--line); background: #f3f9f9; }
.selected-node-card > span { display: block; margin-bottom: 5px; color: #6a9195; font: 8px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; letter-spacing: 0.08em; }
.selected-node-card > div { min-width: 0; display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 6px; }
.selected-node-card code { padding: 2px 4px; border: 1px solid #cce0e2; border-radius: 3px; background: #fff; color: #34747a; font-size: 8px; }
.selected-node-card strong { min-width: 0; overflow: hidden; color: #405267; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.selected-node-card b { min-width: 26px; padding: 2px 4px; border: 1px solid; border-radius: 4px; font: 700 8px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; text-align: center; }
.diagnostics-panel header { min-height: 49px; justify-content: space-between; gap: 10px; padding: 8px 11px; border-bottom: 1px solid var(--line); background: #f8fafc; }
.diagnostics-panel header > div { display: flex; flex-direction: column; gap: 1px; }
.diagnostics-panel header div span { color: #8b99ab; font: 8px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; letter-spacing: 0.08em; }
.diagnostics-panel header strong { color: #475569; font-size: 12px; }
.diagnostics-panel header > span { min-width: 21px; padding: 2px 5px; border-radius: 9px; background: #e7edf3; color: #68798e; font: 9px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; text-align: center; }
.diagnostics-content { min-height: 0; flex: 1; overflow: auto; padding: 11px; }
.all-valid { display: flex; flex-direction: column; align-items: center; padding: 28px 10px 24px; color: #43806e; text-align: center; }
.all-valid > .el-icon { margin-bottom: 9px; font-size: 25px; }
.all-valid strong { font-size: 11px; }
.all-valid p { margin: 5px 0 0; color: #8492a5; font-size: 9px; line-height: 1.5; }
.issue-list { display: flex; flex-direction: column; gap: 6px; }
.issue-list button { display: flex; align-items: flex-start; gap: 6px; padding: 7px; border: 1px solid; border-radius: 5px; text-align: left; font-size: 9px; line-height: 1.5; cursor: pointer; }
.issue-list button span { display: flex; flex-direction: column; gap: 1px; }
.issue-list button strong { font-size: 8px; }
.issue-item--error { border-color: #ffd2d2 !important; background: #fff7f7; color: #ad3038; }
.issue-item--warning { border-color: #f5dda9 !important; background: #fffbef; color: #8e630e; }
.structure-summary { justify-content: space-between; gap: 6px; margin-top: 15px; padding-top: 12px; border-top: 1px solid #edf1f5; }
.structure-summary > div { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 2px; padding: 7px; border-radius: 5px; background: #f7f9fb; }
.structure-summary span { color: #8a98a9; font-size: 8px; }
.structure-summary strong { color: #405267; font: 13px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
.interaction-help { margin-top: 16px; padding-top: 13px; border-top: 1px solid #edf1f5; }
.interaction-help > strong { color: #526276; font-size: 10px; }
.interaction-help ul { margin: 7px 0 0; padding-left: 16px; color: #7c8b9d; font-size: 9px; line-height: 1.8; }
.interaction-help b { color: var(--accent); }
.diagnostics-panel footer { min-height: 34px; display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 0 10px; border-top: 1px solid var(--line); color: #8a98a9; font: 8px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }

.quote-settings { display: flex; flex-direction: column; gap: 10px; }
.quote-settings__title { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding-bottom: 9px; border-bottom: 1px solid #edf1f5; }
.quote-settings__title strong { color: #334155; font-size: 12px; }
.quote-settings__title span { color: #8a98a9; font-size: 9px; }
.quote-setting-row { display: grid; grid-template-columns: 58px 1fr; align-items: center; gap: 9px; color: #526276; font-size: 10px; }
.quote-settings :deep(.el-select) { width: 100%; --el-transition-duration: 0s; --el-transition-duration-fast: 0s; }
.quote-settings :deep(.el-select__wrapper) { min-height: 29px; font-size: 10px; transition-duration: 0s; }
:global(.sml-quote-select-popper.el-select__popper) { --el-transition-duration: 0s; --el-transition-duration-fast: 0s; contain: layout; }
:global(.sml-quote-select-popper.el-zoom-in-top-enter-active),
:global(.sml-quote-select-popper.el-zoom-in-top-leave-active) { transition-duration: 0s !important; }
.quote-settings p { margin: 0; padding-top: 2px; color: #8492a5; font-size: 9px; line-height: 1.55; }

.sml-context-menu { position: fixed; z-index: 5000; width: 216px; padding: 5px; border: 1px solid #d4dee8; border-radius: 7px; background: #fff; box-shadow: 0 12px 30px rgb(15 23 42 / 0.17), 0 2px 6px rgb(15 23 42 / 0.08); color: #334155; }
.context-menu__header { min-width: 0; display: flex; align-items: center; gap: 7px; padding: 5px 7px 7px; border-bottom: 1px solid #edf1f5; }
.context-menu__header span { flex: 0 0 auto; color: #8290a2; font: 8px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
.context-menu__header strong { min-width: 0; overflow: hidden; color: #465569; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.sml-context-menu > button { width: 100%; height: 29px; display: grid; grid-template-columns: 20px 1fr auto; align-items: center; gap: 6px; padding: 0 7px; border: 0; border-radius: 4px; background: transparent; color: #465569; font-size: 10px; text-align: left; cursor: pointer; }
.sml-context-menu > button:hover:not(:disabled),
.sml-context-menu > button:focus-visible { background: #edf7f7; color: #096f78; }
.sml-context-menu > button:disabled { color: #b6c0cc; cursor: not-allowed; }
.sml-context-menu > button .el-icon { font-size: 13px; }
.sml-context-menu kbd { padding: 1px 3px; border: 1px solid #d7dfe8; border-bottom-width: 2px; border-radius: 3px; background: #f8fafc; color: #7d8b9e; font: 7px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
.sml-context-menu .context-menu__danger { color: #b23842; }
.sml-context-menu .context-menu__danger:hover:not(:disabled) { background: #fff1f2; color: #b4232d; }
.context-menu__separator { height: 1px; margin: 4px 5px; background: #edf1f5; }

button:focus-visible,
input:focus-visible,
select:focus-visible { outline: 2px solid #24a4ac; outline-offset: 2px; }

@media (max-width: 1180px) {
  .editor-header { grid-template-columns: 1fr; }
  .header-actions { justify-content: flex-start; }
  .editor-layout { grid-template-columns: 1fr; overflow-y: auto; }
  .source-panel { min-height: 360px; }
  .diagnostics-panel { min-height: 260px; }
  .diagnostics-content { display: grid; grid-template-columns: minmax(220px, 1fr) minmax(220px, 1fr); gap: 16px; }
}

@media (max-width: 760px) {
  .template-picker { width: 100%; }
  .template-picker :deep(.el-select) { min-width: 0; flex: 1; }
  .diagnostics-content { display: block; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { scroll-behavior: auto !important; transition-duration: 0.01ms !important; }
}
</style>

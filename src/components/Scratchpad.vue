<template>
  <div class="scratchpad-container flex flex-col h-full bg-white border-t border-slate-200">
    <div class="flex items-center justify-between px-4 py-2 border-b border-slate-100 bg-slate-50 flex-shrink-0">
      <div class="flex items-center gap-2">
        <el-icon class="text-indigo-500 text-lg"><DocumentAdd /></el-icon>
        <h2 class="text-sm font-semibold text-slate-700 m-0">随手记 (Scratchpad)</h2>
      </div>
      <div class="flex items-center gap-2">
        <el-tag size="small" type="info" class="!border-transparent !bg-slate-200 !text-slate-600">已自动保存</el-tag>
        <el-button size="small" plain @click="addBlock()">
          <el-icon class="mr-1"><Plus /></el-icon> 添加区块
        </el-button>
        <el-button size="small" type="danger" plain @click="clearAll" v-if="blocks.length > 0">
          清空
        </el-button>
        <el-tooltip v-if="!isStandalone" content="进入全屏独立页" placement="top" :show-after="500">
          <el-button size="small" plain @click="goFullscreen">
            <el-icon><FullScreen /></el-icon>
          </el-button>
        </el-tooltip>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto p-4 bg-slate-50 custom-scrollbar">
      <div v-if="blocks.length === 0" class="h-full flex flex-col items-center justify-center text-slate-400">
        <el-icon :size="48" class="mb-2 text-slate-300"><EditPen /></el-icon>
        <p>暂无记录，点击右上角添加新区块开始记录。</p>
        <p class="text-xs mt-1">支持纯文本、JSON、JavaScript 等多种语言高亮</p>
      </div>

      <div
        v-for="(block, index) in blocks"
        :key="block.id"
        class="group bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden mb-4 transition-all hover:border-indigo-300"
      >
        <!-- Block Header -->
        <div class="flex items-center justify-between px-3 py-1.5 bg-slate-100/50 border-b border-slate-100 relative opacity-50 group-hover:opacity-100 transition-opacity">
          <div class="flex items-center gap-2">
            <el-select
              v-model="block.language"
              size="small"
              class="w-32"
              @change="saveState"
            >
              <el-option label="纯文本" value="text" />
              <el-option label="JSON" value="json" />
              <el-option label="JavaScript" value="javascript" />
              <el-option label="HTML" value="html" />
              <el-option label="CSS" value="css" />
              <el-option label="C++" value="cpp" />
              <el-option label="Java" value="java" />
              <el-option label="Python" value="python" />
              <el-option label="Rust" value="rust" />
              <el-option label="SQL" value="sql" />
              <el-option label="XML" value="xml" />
              <el-option label="PHP" value="php" />
              <el-option label="Markdown" value="markdown" />
              <el-option label="Vue" value="vue" />
            </el-select>
          </div>
          <div class="flex items-center gap-1">
            <el-tooltip content="向上方插入" placement="top" :show-after="500">
              <el-button size="small" link @click="addBlock(index)">
                <el-icon><Top /></el-icon>
              </el-button>
            </el-tooltip>
            <el-button size="small" link type="danger" @click="removeBlock(block.id)">
              <el-icon><Delete /></el-icon>
            </el-button>
          </div>
        </div>

        <!-- CodeMirror Editor -->
        <codemirror
          v-model="block.content"
          placeholder="在此输入内容 (按下 Ctrl+Enter 可快速向下插入新区块)..."
          :style="{ minHeight: '80px' }"
          :autofocus="true"
          :indent-with-tab="true"
          :tab-size="2"
          :extensions="getExtensions(block.language, index)"
          @change="saveState"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { DocumentAdd, Plus, Top, Delete, EditPen, FullScreen } from '@element-plus/icons-vue'
import { Codemirror } from 'vue-codemirror'
import { json } from '@codemirror/lang-json'
import { javascript } from '@codemirror/lang-javascript'
import { html } from '@codemirror/lang-html'
import { css } from '@codemirror/lang-css'
import { cpp } from '@codemirror/lang-cpp'
import { java } from '@codemirror/lang-java'
import { python } from '@codemirror/lang-python'
import { rust } from '@codemirror/lang-rust'
import { sql } from '@codemirror/lang-sql'
import { xml } from '@codemirror/lang-xml'
import { php } from '@codemirror/lang-php'
import { markdown } from '@codemirror/lang-markdown'
import { vue } from '@codemirror/lang-vue'
import { EditorView, keymap } from '@codemirror/view'

const props = defineProps({
  isStandalone: {
    type: Boolean,
    default: false
  }
})

const router = useRouter()

interface NoteBlock {
  id: string
  content: string
  language: string
}

const STORAGE_KEY = 'secstools_scratchpad_blocks'

const blocks = ref<NoteBlock[]>([])

// Basic CodeMirror theme to look clean and neat
const customTheme = EditorView.theme({
  "&": {
    fontSize: "14px",
    backgroundColor: "transparent",
  },
  ".cm-content": {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
  },
  "&.cm-focused .cm-cursor": {
    borderLeftColor: "#2563eb"
  },
  "&.cm-focused .cm-selectionBackground, ::selection": {
    backgroundColor: "#dbeafe"
  },
  ".cm-gutters": {
    backgroundColor: "#f8fafc",
    color: "#94a3b8",
    borderRight: "1px solid #e2e8f0"
  },
  ".cm-activeLineGutter": {
    backgroundColor: "#e2e8f0",
    color: "#475569"
  }
})

const getExtensions = (lang: string, index: number) => {
  const exts = [
    customTheme,
    keymap.of([{
      key: 'Mod-Enter', // Mod means Ctrl on Windows/Linux, Cmd on Mac
      run: () => {
        addBlockAndFocus(index + 1)
        return true
      }
    }])
  ]
  switch (lang) {
    case 'json': exts.push(json()); break
    case 'javascript': exts.push(javascript()); break
    case 'html': exts.push(html()); break
    case 'css': exts.push(css()); break
    case 'cpp': exts.push(cpp()); break
    case 'java': exts.push(java()); break
    case 'python': exts.push(python()); break
    case 'rust': exts.push(rust()); break
    case 'sql': exts.push(sql()); break
    case 'xml': exts.push(xml()); break
    case 'php': exts.push(php()); break
    case 'markdown': exts.push(markdown()); break
    case 'vue': exts.push(vue()); break
  }
  return exts
}

const generateId = () => Math.random().toString(36).substring(2, 9)

const addBlock = (index?: number) => {
  const newBlock: NoteBlock = {
    id: generateId(),
    content: '',
    language: 'text'
  }
  if (typeof index === 'number') {
    blocks.value.splice(index, 0, newBlock)
  } else {
    blocks.value.push(newBlock)
  }
  saveState()
}

const addBlockAndFocus = (index: number) => {
  addBlock(index)
  nextTick(() => {
    // Attempt to focus the newly activated codemirror input box.
    const editors = document.querySelectorAll('.scratchpad-container .cm-content')
    if (editors && editors[index]) {
      ;(editors[index] as HTMLElement).focus()
    }
  })
}

const goFullscreen = () => {
  router.push('/tools/scratchpad')
}

const removeBlock = (id: string) => {
  blocks.value = blocks.value.filter(b => b.id !== id)
  saveState()
}

const clearAll = () => {
  if (confirm('确定要清空所有记录吗？')) {
    blocks.value = []
    saveState()
  }
}

const saveState = () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(blocks.value))
}

const loadState = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      blocks.value = JSON.parse(saved)
    }
  } catch (e) {
    console.error('Failed to load scratchpad state', e)
  }

  if (blocks.value.length === 0) {
    addBlock() // Start with at least one block if empty
  }
}

onMounted(() => {
  loadState()
})
</script>

<style scoped>
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

:deep(.cm-editor) {
  outline: none !important;
}
</style>

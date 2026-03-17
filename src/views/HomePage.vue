<template>
  <div :class="['h-full flex px-2 py-4', splitMode === 'horizontal' ? 'flex-row' : 'flex-col gap-2']">
    <!-- 上半部分：工具列表 -->
    <div class="flex-1 overflow-y-auto px-1 custom-scrollbar">

      <!-- 互联网搜索 -->
      <div class="mb-8 mt-2">
        <el-input
          v-model="searchQuery"
          placeholder="搜索互联网内容..."
          size="large"
          class="w-full shadow-sm hover:shadow transition-shadow rounded-xl search-bar-wrapper"
          @keyup.enter="performSearch"
        >
          <template #prepend>
            <el-select v-model="searchEngine" style="width: 110px" size="large">
              <el-option label="必应 (Bing)" value="bing" />
              <el-option label="百度 (Baidu)" value="baidu" />
            </el-select>
          </template>
          <template #append>
            <el-button @click="performSearch" class="px-6">
              <el-icon class="mr-1"><component :is="Icons.Search" /></el-icon> 搜索
            </el-button>
          </template>
        </el-input>
      </div>

      <div class="mb-8" v-if="favoriteTools.length > 0">
        <h2 class="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2 mb-4">
          <el-icon class="text-amber-500"><StarFilled /></el-icon>
          我的收藏
        </h2>
        <div class="tools-grid flex flex-wrap gap-6 xl:grid xl:grid-cols-4 lg:grid-cols-3 md:grid-cols-2">
          <div
            v-for="tool in favoriteTools"
            :key="`fav-${tool.id}`"
            @click="goToTool(tool.path)"
            class="group relative bg-white rounded-xl border border-slate-200 p-5 cursor-pointer hover:-translate-y-1 hover:shadow-lg hover:border-blue-300 transition-all duration-300"
          >
            <div class="absolute top-3 right-3 p-1.5 rounded-full hover:bg-slate-100 transition-colors z-10" @click.stop="toggleFavorite(tool.id, $event)">
              <el-icon class="text-amber-500 text-lg transition-transform hover:scale-110"><StarFilled /></el-icon>
            </div>
            <div class="flex items-start md:items-center h-full space-x-4">
              <div class="flex-shrink-0 p-3 rounded-lg bg-slate-50 group-hover:bg-blue-50 transition-colors duration-300">
                <el-icon :size="32" :color="tool.color" class="block">
                  <component :is="Icons[tool.icon as keyof typeof Icons] || Icons.Tools"></component>
                </el-icon>
              </div>
              <div class="flex flex-col flex-1 pr-6">
                <h3 class="m-0 text-base font-semibold text-slate-800 group-hover:text-blue-600 transition-colors duration-200 mb-1.5">{{ tool.name }}</h3>
                <p class="m-0 text-sm text-slate-500 line-clamp-2 leading-relaxed">{{ tool.desc }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-for="category in toolsConfig" :key="category.id" class="mb-8">
        <div class="mb-4">
          <h2 class="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <el-icon class="text-blue-500"><component :is="Icons[category.icon as keyof typeof Icons] || Icons.Tools"/></el-icon>
            {{ category.name }}
          </h2>
        </div>

        <div class="tools-grid flex flex-wrap gap-6 xl:grid xl:grid-cols-4 lg:grid-cols-3 md:grid-cols-2">
          <div
            v-for="tool in category.tools"
            :key="tool.id"
            @click="goToTool(tool.path)"
            class="group relative bg-white rounded-xl border border-slate-200 p-5 cursor-pointer hover:-translate-y-1 hover:shadow-lg hover:border-blue-300 transition-all duration-300"
          >
            <div class="absolute top-3 right-3 p-1.5 rounded-full hover:bg-slate-100 transition-colors z-10" @click.stop="toggleFavorite(tool.id, $event)">
              <el-icon :class="[isFavorite(tool.id) ? 'text-amber-500' : 'text-slate-300 hover:text-amber-400', 'text-lg transition-transform hover:scale-110']">
                <component :is="isFavorite(tool.id) ? Icons.StarFilled : Icons.Star" />
              </el-icon>
            </div>
            <div class="flex items-start md:items-center h-full space-x-4">
              <div class="flex-shrink-0 p-3 rounded-lg bg-slate-50 group-hover:bg-blue-50 transition-colors duration-300">
                <el-icon :size="32" :color="tool.color" class="block">
                  <component :is="Icons[tool.icon as keyof typeof Icons] || Icons.Tools"></component>
                </el-icon>
              </div>
              <div class="flex flex-col flex-1 pr-6">
                <h3 class="m-0 text-base font-semibold text-slate-800 group-hover:text-blue-600 transition-colors duration-200 mb-1.5">{{ tool.name }}</h3>
                <p class="m-0 text-sm text-slate-500 line-clamp-2 leading-relaxed">{{ tool.desc }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 拖拽调整区域条 -->
    <div
      :class="[
        'transition-colors bg-slate-100 hover:bg-indigo-300 active:bg-indigo-400 rounded-full relative z-10 shrink-0',
        splitMode === 'horizontal' ? 'w-1.5 cursor-col-resize mx-2 mt-2 mb-2' : 'h-1.5 cursor-row-resize my-1 mx-2'
      ]"
      @mousedown="startDrag"
    ></div>

    <!-- 下半部分：随手记区块 -->
    <div
      class="border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col bg-white shrink-0"
      :style="splitMode === 'horizontal'
        ? { width: scratchpadWidth + '%', minWidth: '300px' }
        : { height: scratchpadHeight + '%', minHeight: '150px' }"
    >
      <Scratchpad :layout-mode="splitMode" @toggle-layout="toggleLayout" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import * as Icons from '@element-plus/icons-vue'
import { StarFilled } from '@element-plus/icons-vue'
import { toolsConfig, flatTools } from '../config/tools'
import { isFavorite, toggleFavorite, favoriteIds } from '../composables/useFavorites'
import Scratchpad from '../components/Scratchpad.vue'

const router = useRouter()

const favoriteTools = computed(() => {
  return flatTools.filter(t => favoriteIds.value.includes(t.id))
})

const goToTool = (path: string) => {
  router.push(path)
}

// === 互联网搜索逻辑 ===
const searchQuery = ref('')
const searchEngine = ref<'bing' | 'baidu'>('bing')

const performSearch = () => {
  const q = searchQuery.value.trim()
  if (!q) return

  let url = ''
  if (searchEngine.value === 'bing') {
    url = `https://www.bing.com/search?q=${encodeURIComponent(q)}`
  } else if (searchEngine.value === 'baidu') {
    url = `https://www.baidu.com/s?wd=${encodeURIComponent(q)}`
  }

  if (url) {
    window.open(url, '_blank')
  }
}

// 监听搜索引擎改变并保存
watch(searchEngine, (newVal) => {
  localStorage.setItem('heySecsTools_searchEngine', newVal)
})

// === 布局模式 (水平 / 垂直) ===
const splitMode = ref<'horizontal' | 'vertical'>('vertical')

const toggleLayout = () => {
  splitMode.value = splitMode.value === 'vertical' ? 'horizontal' : 'vertical'
  localStorage.setItem('heySecsTools_splitMode', splitMode.value)
}

// === 拖拽调整大小逻辑 ===
const scratchpadHeight = ref(45) // 仅当垂直时
const scratchpadWidth = ref(40)  // 当水平时

// 页面加载时的状态初始化
onMounted(() => {
  const savedEngine = localStorage.getItem('heySecsTools_searchEngine') as 'bing' | 'baidu'
  if (savedEngine === 'bing' || savedEngine === 'baidu') {
    searchEngine.value = savedEngine
  }

  const savedMode = localStorage.getItem('heySecsTools_splitMode') as 'horizontal' | 'vertical'
  if (savedMode === 'horizontal' || savedMode === 'vertical') {
    splitMode.value = savedMode
  }

  const savedHeight = localStorage.getItem('heySecsTools_scratchpadHeight')
  if (savedHeight) scratchpadHeight.value = parseFloat(savedHeight)

  const savedWidth = localStorage.getItem('heySecsTools_scratchpadWidth')
  if (savedWidth) scratchpadWidth.value = parseFloat(savedWidth)
})

const startDrag = (e: MouseEvent) => {
  e.preventDefault()

  if (splitMode.value === 'vertical') {
    const startY = e.clientY
    const startHeight = scratchpadHeight.value
    const containerHeight = window.innerHeight - 60

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = startY - moveEvent.clientY
      const deltaPercent = (deltaY / containerHeight) * 100
      let newHeight = startHeight + deltaPercent
      if (newHeight < 20) newHeight = 20
      if (newHeight > 85) newHeight = 85
      scratchpadHeight.value = newHeight
    }
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
      localStorage.setItem('heySecsTools_scratchpadHeight', scratchpadHeight.value.toString())
    }
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'row-resize'
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  } else {
    // 水平拖拽逻辑
    const startX = e.clientX
    const startWidth = scratchpadWidth.value
    const containerWidth = window.innerWidth - 64 // 减去左侧边栏等

    const onMouseMove = (moveEvent: MouseEvent) => {
      // 鼠标向左移动 (moveEvent.clientX 变小)，左侧变小，右区变大。
      const deltaX = startX - moveEvent.clientX
      const deltaPercent = (deltaX / containerWidth) * 100
      let newWidth = startWidth + deltaPercent
      if (newWidth < 20) newWidth = 20
      if (newWidth > 85) newWidth = 85
      scratchpadWidth.value = newWidth
    }
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
      localStorage.setItem('heySecsTools_scratchpadWidth', scratchpadWidth.value.toString())
    }
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }
}
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

.tools-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
}
</style>

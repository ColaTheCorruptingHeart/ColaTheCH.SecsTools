<template>
  <el-container class="h-screen w-full bg-slate-50">
    <el-aside
      :width="isCollapse ? '64px' : '240px'"
      class="bg-white border-r border-slate-200 transition-all duration-300 shadow-sm flex flex-col relative overflow-visible! z-20"
    >
      <div class="h-14 flex items-center border-b border-slate-100 bg-white shrink-0 transition-all overflow-hidden" :class="isCollapse ? 'justify-center px-0' : 'justify-start px-4'">
        <div class="w-8 h-8 rounded-md bg-blue-100/50 flex shrink-0 items-center justify-center text-blue-600 transition-all">
          <el-icon :size="18"><component :is="Icons.Grid" /></el-icon>
        </div>
        <span v-if="!isCollapse" class="ml-3 font-bold text-slate-800 shrink-0 whitespace-nowrap text-base tracking-wide">SECS Tools</span>
      </div>

      <!-- 将搜索栏移出 el-menu，避免受到 el-menu 样式的污染 -->
      <div class="px-3 py-3 border-b border-slate-50 shrink-0" v-show="!isCollapse">
        <div class="relative" ref="searchContainer" style="position: relative;">
          <el-icon style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); z-index: 10; font-size: 16px; color: #94a3b8;"><Search /></el-icon>
          <input
            v-model="searchQuery"
            @focus="isSearchFocused = true"
            @blur="handleSearchBlur"
            type="text"
            placeholder="快速搜索..."
            class="w-full bg-slate-50 border border-slate-200 rounded-md py-1.5 pl-9 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all text-slate-600 placeholder-slate-400"
          />
          <span v-if="!searchQuery" style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%);" class="text-xs text-slate-400 bg-white px-1 border border-slate-200 rounded shadow-sm">Ctrl K</span>

          <!-- 搜索结果下拉框 -->
          <div v-if="isSearchFocused && searchQuery" class="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg z-50 max-h-64 overflow-y-auto py-1 custom-scrollbar">
            <template v-if="searchResults.length > 0">
              <div
                v-for="item in searchResults"
                :key="item.id"
                @mousedown.prevent="goToTool(item.path)"
                class="px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 hover:text-blue-600 cursor-pointer rounded-md mx-1 transition-colors flex items-center"
              >
                <el-icon class="mr-2 text-slate-400"><component :is="Icons.Tools" /></el-icon>
                {{ item.name }}
              </div>
            </template>
            <div v-else class="px-3 py-4 text-sm text-slate-500 text-center">
              未找到相关工具
            </div>
          </div>
        </div>
      </div>

      <el-menu
        :default-active="activeMenu"
        class="flex-1 border-r-0 overflow-y-auto overflow-x-hidden no-scrollbar custom-menu"
        router
        :collapse="isCollapse"
        :collapse-transition="false"
      >
        <el-menu-item index="/">
          <el-icon><HomeFilled /></el-icon>
          <template #title>
            <span class="font-medium text-[13.5px]">主页</span>
          </template>
        </el-menu-item>

        <template v-for="category in toolsConfig" :key="category.id">
          <el-sub-menu v-if="category.id !== 'hidden-tools'" :index="category.id">
            <template #title>
              <el-icon><component :is="Icons[category.icon as keyof typeof Icons] || Icons.Tools" /></el-icon>
              <span class="font-medium text-[13.5px]">{{ category.name }}</span>
            </template>
            <template v-for="tool in category.tools" :key="tool.id">
              <el-menu-item v-if="!tool.hidden" :index="tool.path" class="text-[13px]">
                {{ tool.name }}
              </el-menu-item>
            </template>
          </el-sub-menu>
        </template>
      </el-menu>

      <!-- 侧边栏折叠把手 -->
      <div
        class="absolute -right-4 top-16 w-8 h-8 bg-white border border-slate-200 rounded-full flex items-center justify-center cursor-pointer shadow-md text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-all z-50 hover:scale-110"
        @click="isCollapse = !isCollapse"
      >
        <el-icon :size="16"><component :is="isCollapse ? Icons.ArrowRight : Icons.ArrowLeft" /></el-icon>
      </div>
    </el-aside>

    <el-container class="flex flex-col overflow-hidden bg-white">
      <el-header class="bg-white border-b border-slate-200 flex items-center px-6 h-14 z-10 sticky top-0">
        <div class="flex items-center w-full">
          <el-breadcrumb separator="/">
            <el-breadcrumb-item :to="{ path: '/' }" class="font-medium text-slate-800">主页</el-breadcrumb-item>
            <el-breadcrumb-item v-if="currentRouteName && currentRouteName !== 'Home'">{{ currentRouteName }}</el-breadcrumb-item>
          </el-breadcrumb>
        </div>
      </el-header>

      <el-main class="bg-white p-6 overflow-auto">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Search, HomeFilled } from '@element-plus/icons-vue'
import * as Icons from '@element-plus/icons-vue'
import { toolsConfig, flatTools } from '../config/tools'

const route = useRoute()
const router = useRouter()
const isCollapse = ref(false)

const searchQuery = ref('')
const isSearchFocused = ref(false)

const syncCollapseState = (path: string) => {
  isCollapse.value = path !== '/home'
}

const activeMenu = computed(() => {
  return route.path
})

const currentRouteName = computed(() => {
  return route.meta.title || route.name || ''
})

const searchResults = computed(() => {
  if (!searchQuery.value) return []
  const query = searchQuery.value.toLowerCase()
  return flatTools.filter(t =>
    t.name.toLowerCase().includes(query) ||
    ((t as any).description && (t as any).description.toLowerCase().includes(query))
  )
})

const goToTool = (path: string) => {
  router.push(path)
  searchQuery.value = ''
  isSearchFocused.value = false
}

const handleSearchBlur = () => {
  // Use a slight delay to allow mousedown event to fire to goToTool before closing
  setTimeout(() => {
    isSearchFocused.value = false
  }, 150)
}

// Ctrl+K to focus search
const handleKeydown = (e: KeyboardEvent) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault()
    isCollapse.value = false
    setTimeout(() => {
      const searchInput = document.querySelector('input[type="text"]') as HTMLInputElement
      if (searchInput) searchInput.focus()
    }, 100)
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

watch(
  () => route.path,
  (path) => {
    syncCollapseState(path)
  },
  { immediate: true }
)

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
/* 隐藏原生滚动条但允许滚动 */
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

/* 自定义轻量滚动条 */
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

/* 自定义菜单样式覆盖以匹配截图风格 */
.custom-menu :deep(.el-menu-item) {
  height: 40px;
  line-height: 40px;
  margin: 4px 12px;
  border-radius: 6px;
  color: #475569;
  min-width: 0;
}
.custom-menu :deep(.el-menu-item.is-active) {
  background-color: #f1f5f9;
  color: #0f172a;
  font-weight: 500;
}
.custom-menu :deep(.el-menu-item:hover) {
  background-color: #f8fafc;
}
.custom-menu :deep(.el-sub-menu__title) {
  height: 40px;
  line-height: 40px;
  margin: 4px 12px;
  border-radius: 6px;
  color: #475569;
  min-width: 0;
}
.custom-menu :deep(.el-sub-menu__title:hover) {
  background-color: #f8fafc;
}
.custom-menu :deep(.el-icon) {
  margin-right: 12px;
  font-size: 16px;
  color: #94a3b8;
}

/* 侧边栏折叠时的特殊样式处理，防止内容溢出或挤压 */
.custom-menu.el-menu--collapse {
  width: 100%;
}
.custom-menu.el-menu--collapse :deep(.el-menu-item) {
  margin: 12px auto !important;
  border-radius: 8px !important;
  width: 48px !important;
  height: 48px !important;
  line-height: 48px !important;
  min-height: 48px !important;
  padding: 0 !important;
  display: flex !important;
  justify-content: center !important;
  align-items: center !important;
  box-sizing: border-box !important;
}
.custom-menu.el-menu--collapse :deep(.el-sub-menu) {
  margin: 12px auto !important;
  display: flex !important;
  justify-content: center !important;
}
.custom-menu.el-menu--collapse :deep(.el-sub-menu__title) {
  margin: 0 !important;
  border-radius: 8px !important;
  width: 48px !important;
  height: 48px !important;
  line-height: 48px !important;
  min-height: 48px !important;
  padding: 0 !important;
  display: flex !important;
  justify-content: center !important;
  align-items: center !important;
  box-sizing: border-box !important;
}
.custom-menu.el-menu--collapse :deep(.el-tooltip__trigger) {
  display: flex !important;
  justify-content: center !important;
  align-items: center !important;
  width: 48px !important;
  height: 48px !important;
  padding: 0 !important;
  box-sizing: border-box !important;
}
.custom-menu.el-menu--collapse :deep(.el-icon) {
  margin: 0 !important;
  width: auto !important;
}
/* 强制隐藏折叠时的右侧箭头与文字 */
.custom-menu.el-menu--collapse :deep(.el-sub-menu__icon-arrow),
.custom-menu.el-menu--collapse :deep(span) {
  display: none !important;
}

/* 过渡动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>

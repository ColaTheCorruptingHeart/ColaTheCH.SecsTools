<template>
  <div class="h-full flex px-2 py-4">
    <div class="flex-1 overflow-y-auto px-1 custom-scrollbar">

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

      <template v-for="category in toolsConfig" :key="category.id">
        <div v-if="category.id !== 'hidden-tools'" class="mb-8">
          <div class="mb-4">
            <h2 class="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
              <el-icon class="text-blue-500"><component :is="Icons[category.icon as keyof typeof Icons] || Icons.Tools"/></el-icon>
              {{ category.name }}
            </h2>
          </div>

          <div class="tools-grid flex flex-wrap gap-6 xl:grid xl:grid-cols-4 lg:grid-cols-3 md:grid-cols-2">
            <template v-for="tool in category.tools" :key="tool.id">
              <div
                v-if="!tool.hidden"
                @click="goToTool(tool.path)"
                class="group relative bg-white rounded-xl border border-slate-200 p-5 cursor-pointer hover:-translate-y-1 hover:shadow-lg hover:border-blue-300 transition-all duration-300 w-full lg:w-auto"
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
          </template>
        </div>
      </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import * as Icons from '@element-plus/icons-vue'
import { StarFilled } from '@element-plus/icons-vue'
import { toolsConfig, flatTools } from '../config/tools'
import { isFavorite, toggleFavorite, favoriteIds } from '../composables/useFavorites'

const router = useRouter()

const favoriteTools = computed(() => {
  return flatTools.filter(t => favoriteIds.value.includes(t.id))
})

const goToTool = (path: string) => {
  router.push(path)
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

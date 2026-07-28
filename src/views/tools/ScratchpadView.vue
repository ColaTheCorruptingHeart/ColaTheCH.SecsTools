<template>
  <div class="h-full flex flex-col gap-4">
    <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div class="flex items-center gap-2">
          <div class="p-2 bg-indigo-50 rounded-lg">
            <el-icon class="text-indigo-500 text-xl"><EditPen /></el-icon>
          </div>
          <div>
            <h2 class="text-lg font-semibold text-slate-800 m-0">随手记 (Scratchpad)</h2>
            <p class="text-xs text-slate-500 m-0 mt-0.5">便捷的临时代码和记录本，支持分块与高亮，Ctrl+Enter快捷新建</p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <el-button size="small" @click="goHome" class="!rounded-md">返回主页</el-button>
        </div>
      </div>
    </div>

    <div class="flex-1 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col min-h-0">
      <Scratchpad :is-standalone="true" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { EditPen } from '@element-plus/icons-vue'
import Scratchpad from '../../components/Scratchpad.vue'

const router = useRouter()

const goHome = () => {
  router.push('/home')
}
</script>

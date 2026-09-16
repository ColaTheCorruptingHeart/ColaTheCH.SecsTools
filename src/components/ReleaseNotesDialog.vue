<template>
  <el-dialog
    v-model="visible"
    class="release-notes-dialog"
    title="版本更新内容"
    :width="dialogWidth"
    append-to-body
    destroy-on-close
  >
    <template #header>
      <div class="flex min-w-0 items-start gap-3 pr-6">
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
          <el-icon :size="21"><Bell /></el-icon>
        </div>
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <h2 class="m-0 text-lg font-semibold text-slate-900">{{ latestRelease.title }}</h2>
            <span class="rounded-full bg-blue-50 px-2 py-0.5 font-mono text-xs font-semibold text-blue-700">
              v{{ latestRelease.version }}
            </span>
          </div>
          <p class="mt-1 mb-0 text-xs text-slate-500">发布于 {{ latestRelease.date }}</p>
        </div>
      </div>
    </template>

    <p class="mt-0 mb-5 text-sm leading-6 text-slate-600">{{ latestRelease.summary }}</p>

    <div class="space-y-4">
      <section v-for="section in latestRelease.sections" :key="section.title">
        <h3 class="mt-0 mb-2 text-sm font-semibold text-slate-800">{{ section.title }}</h3>
        <ul class="m-0 space-y-2 pl-0">
          <li
            v-for="item in section.items"
            :key="item"
            class="flex items-start gap-2 text-sm leading-6 text-slate-600"
          >
            <el-icon class="mt-1 shrink-0 text-emerald-500" :size="16"><CircleCheckFilled /></el-icon>
            <span>{{ item }}</span>
          </li>
        </ul>
      </section>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2">
        <el-button @click="visible = false">稍后提醒</el-button>
        <el-button type="primary" @click="acknowledge">我知道了</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Bell, CircleCheckFilled } from '@element-plus/icons-vue'
import { appVersion } from '../config/appVersion'
import { latestRelease, RELEASE_ACKNOWLEDGEMENT_STORAGE_KEY } from '../config/releaseNotes'

const visible = ref(false)

const dialogWidth = computed(() => 'min(640px, calc(100vw - 32px))')

const readAcknowledgedVersion = () => {
  try {
    return localStorage.getItem(RELEASE_ACKNOWLEDGEMENT_STORAGE_KEY)
  } catch {
    return null
  }
}

const acknowledge = () => {
  try {
    localStorage.setItem(RELEASE_ACKNOWLEDGEMENT_STORAGE_KEY, latestRelease.version)
  } catch {
    // The dialog can still be closed when browser storage is unavailable.
  }
  visible.value = false
}

const open = () => {
  visible.value = true
}

onMounted(() => {
  if (latestRelease.version === appVersion && readAcknowledgedVersion() !== appVersion) {
    open()
  }
})

defineExpose({ open })
</script>

<style>
.release-notes-dialog .el-dialog__header {
  margin-right: 0;
  padding-bottom: 14px;
  border-bottom: 1px solid #f1f5f9;
}

.release-notes-dialog .el-dialog__body {
  max-height: min(62vh, 620px);
  overflow-y: auto;
}
</style>

/// <reference lib="webworker" />

import { analyzeLogTimeline } from './log-timeline/parser'
import type { CeidMatchMode, RuleItem, SxFyRuleItem, TimelineItem } from './log-timeline/types'

type WorkerRequest = {
  logContent: string
  rulesList: RuleItem[]
  sxfyList: SxFyRuleItem[]
  ceidMatchMode: CeidMatchMode
}

type WorkerResponse =
  | {
      type: 'success'
      timeline: TimelineItem[]
    }
  | {
      type: 'error'
      error: string
    }

const workerScope = self as DedicatedWorkerGlobalScope

workerScope.onmessage = (event: MessageEvent<WorkerRequest>) => {
  try {
    const timeline = analyzeLogTimeline(
      event.data.logContent,
      event.data.rulesList,
      event.data.sxfyList,
      event.data.ceidMatchMode
    )

    const response: WorkerResponse = {
      type: 'success',
      timeline
    }

    workerScope.postMessage(response)
  } catch (error: unknown) {
    const response: WorkerResponse = {
      type: 'error',
      error: error instanceof Error ? error.message : '日志解析失败'
    }

    workerScope.postMessage(response)
  }
}

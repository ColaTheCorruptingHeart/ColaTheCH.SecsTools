/// <reference lib="webworker" />

import { analyzeLogTimelineDetailed } from './log-timeline/parser'
import type { CeidMatchMode, RuleItem, SxFyRuleItem, TimelineItem, TimelineParseDiagnostic } from './log-timeline/types'

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
      diagnostics: TimelineParseDiagnostic[]
      messageCount: number
    }
  | {
      type: 'error'
      error: string
    }

const workerScope = self as DedicatedWorkerGlobalScope

workerScope.onmessage = (event: MessageEvent<WorkerRequest>) => {
  try {
    const result = analyzeLogTimelineDetailed(
      event.data.logContent,
      event.data.rulesList,
      event.data.sxfyList,
      event.data.ceidMatchMode
    )

    const response: WorkerResponse = {
      type: 'success',
      timeline: result.timeline,
      diagnostics: result.diagnostics,
      messageCount: result.messageCount
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

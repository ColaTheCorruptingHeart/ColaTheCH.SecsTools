/// <reference lib="webworker" />

import { analyzeSecsLogDiff } from './secs-log-diff/analyzer'
import type { SecsLogDiffWorkerRequest, SecsLogDiffWorkerResponse } from './secs-log-diff/types'

const workerScope = self as DedicatedWorkerGlobalScope

workerScope.onmessage = (event: MessageEvent<SecsLogDiffWorkerRequest>) => {
  try {
    if (event.data.type !== 'analyze') {
      throw new Error('不支持的分析任务')
    }

    const result = analyzeSecsLogDiff(event.data.baselineText, event.data.targetText, event.data.options)
    const response: SecsLogDiffWorkerResponse = {
      type: 'success',
      result
    }

    workerScope.postMessage(response)
  } catch (error: unknown) {
    const response: SecsLogDiffWorkerResponse = {
      type: 'error',
      error: error instanceof Error ? error.message : 'SECS 日志差异分析失败'
    }

    workerScope.postMessage(response)
  }
}

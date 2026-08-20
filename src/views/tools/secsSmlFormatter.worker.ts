/// <reference lib="webworker" />

import { formatSecsSml, type SmlDiagnostic, type SmlParseMode } from './secsSml'

interface FormattedLineMeta {
  clickable: boolean
  path: string
  jumpToIndex?: number
  isClosing: boolean
}

type WorkerResponse =
  | { type: 'success'; text: string; lineMeta: FormattedLineMeta[]; diagnostics: SmlDiagnostic[] }
  | { type: 'error'; message: string }

interface WorkerRequest {
  text: string
  mode: SmlParseMode
}

const workerScope = self as DedicatedWorkerGlobalScope

workerScope.onmessage = (event: MessageEvent<WorkerRequest>) => {
  try {
    const result = formatSecsSml(event.data.text, { mode: event.data.mode })
    const lineMeta = result.lines.map(line => ({
      clickable: line.clickable,
      path: line.path,
      jumpToIndex: line.jumpToIndex,
      isClosing: line.text.trim().startsWith('>')
    }))

    const response: WorkerResponse = {
      type: 'success',
      text: result.text,
      lineMeta,
      diagnostics: result.diagnostics || []
    }

    workerScope.postMessage(response)
  } catch (error) {
    const response: WorkerResponse = {
      type: 'error',
      message: error instanceof Error ? error.message : '格式化失败，请检查报文内容'
    }

    workerScope.postMessage(response)
  }
}

export {}

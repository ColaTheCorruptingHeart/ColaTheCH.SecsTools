/// <reference lib="webworker" />

import { formatSecsSml } from './secsSml'

interface FormattedLineMeta {
  clickable: boolean
  path: string
  jumpToIndex?: number
  isClosing: boolean
}

type WorkerResponse =
  | { type: 'success'; text: string; lineMeta: FormattedLineMeta[] }
  | { type: 'error'; message: string }

const workerScope = self as DedicatedWorkerGlobalScope

workerScope.onmessage = (event: MessageEvent<string>) => {
  try {
    const result = formatSecsSml(event.data)
    const lineMeta = result.lines.map(line => ({
      clickable: line.clickable,
      path: line.path,
      jumpToIndex: line.jumpToIndex,
      isClosing: line.text.trim().startsWith('>')
    }))

    const response: WorkerResponse = {
      type: 'success',
      text: result.text,
      lineMeta
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

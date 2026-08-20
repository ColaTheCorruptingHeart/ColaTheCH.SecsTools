/// <reference lib="webworker" />

import { extractS1F12Svid, type SvidRow } from './s1f12-svid'
import type { SmlDiagnostic } from './secsSml'

type ExtractMessage =
  | { type: 'success'; rows: SvidRow[]; warnings?: string[]; diagnostics: SmlDiagnostic[] }
  | { type: 'error'; message: string }

const workerScope = self as DedicatedWorkerGlobalScope

workerScope.onmessage = (event: MessageEvent<string>) => {
  try {
    const result = extractS1F12Svid(event.data)
    const message: ExtractMessage = {
      type: 'success',
      rows: result.rows,
      warnings: result.warnings.length ? result.warnings : undefined,
      diagnostics: result.diagnostics
    }

    workerScope.postMessage(message)
  } catch (error) {
    const message: ExtractMessage = {
      type: 'error',
      message: error instanceof Error ? error.message : '解析失败，请检查报文格式'
    }

    workerScope.postMessage(message)
  }
}

export {}

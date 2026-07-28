/// <reference lib="webworker" />

import { getNodeValueText, parseSmlTree, type SecsSmlNode } from './secsSml'

interface SvidRow {
  index: number
  svid: string
  svname: string
  units: string
  remark: string
}

type ExtractMessage =
  | { type: 'success'; rows: SvidRow[] }
  | { type: 'error'; message: string }

function normalizeCellValue(node: SecsSmlNode | undefined) {
  const rawValue = getNodeValueText(node)
  if (!rawValue) return ''

  if (rawValue.startsWith('"') && rawValue.endsWith('"')) {
    return rawValue.slice(1, -1)
  }

  return rawValue
}

function extractRows(rootNode: SecsSmlNode | undefined) {
  if (!rootNode) return []

  return rootNode.children
    .map((itemNode, index) => ({
      index: index + 1,
      svid: normalizeCellValue(itemNode.children[0]),
      svname: normalizeCellValue(itemNode.children[1]),
      units: normalizeCellValue(itemNode.children[2]),
      remark: ''
    }))
    .filter(row => row.svid || row.svname || row.units)
}

const workerScope = self as DedicatedWorkerGlobalScope

workerScope.onmessage = (event: MessageEvent<string>) => {
  try {
    const parsed = parseSmlTree(event.data)
    const message: ExtractMessage = {
      type: 'success',
      rows: extractRows(parsed.roots[0])
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

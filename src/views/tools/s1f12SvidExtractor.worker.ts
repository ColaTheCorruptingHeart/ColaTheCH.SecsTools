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
  | { type: 'success'; rows: SvidRow[]; warnings?: string[] }
  | { type: 'error'; message: string }

function normalizeCellValue(node: SecsSmlNode | undefined) {
  const rawValue = getNodeValueText(node)
  if (!rawValue) return ''

  return rawValue.replace(/^(['"])([\s\S]*)\1$/, '$2').trim()
}

function extractRows(rootNode: SecsSmlNode | undefined, warnings: string[]) {
  if (!rootNode) {
    warnings.push('未找到 S1F12 的根列表')
    return []
  }

  return rootNode.children
    .map((itemNode, index) => {
      const svid = normalizeCellValue(itemNode.children[0])
      const svname = normalizeCellValue(itemNode.children[1])
      const units = normalizeCellValue(itemNode.children[2])
      if (itemNode.children.length < 3) warnings.push(`第 ${index + 1} 条 SVID 记录字段不足，已按可用字段提取`)
      return { index: index + 1, svid, svname, units, remark: '' }
    })
    .filter(row => row.svid || row.svname || row.units)
}

const workerScope = self as DedicatedWorkerGlobalScope

workerScope.onmessage = (event: MessageEvent<string>) => {
  try {
    const parsed = parseSmlTree(event.data)
    const warnings = (parsed.diagnostics || [])
      .map(diagnostic => `第 ${diagnostic.line} 行：${diagnostic.message}`)
    const header = parsed.header.split(/\s+/)[0]?.toUpperCase() || ''
    if (header && header !== 'S1F12') warnings.push(`报文头为 ${header}，不是 S1F12；仍按 S1F12 结构尝试提取`)
    const message: ExtractMessage = {
      type: 'success',
      rows: extractRows(parsed.roots[0], warnings),
      warnings: warnings.length ? warnings : undefined
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

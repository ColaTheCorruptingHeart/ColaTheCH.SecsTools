import {
  formatSmlDiagnostic,
  getNodeValueText,
  parseSmlTree,
  type SecsSmlNode,
  type SmlDiagnostic,
  type SmlParseOptions
} from './secsSml'

export interface SvidRow {
  index: number
  svid: string
  svname: string
  units: string
  remark: string
}

export interface SvidExtractResult {
  rows: SvidRow[]
  warnings: string[]
  diagnostics: SmlDiagnostic[]
}

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

export function extractS1F12Svid(text: string, options: SmlParseOptions = {}): SvidExtractResult {
  const parsed = parseSmlTree(text, options)
  const warnings = parsed.diagnostics.map(formatSmlDiagnostic)
  const header = parsed.header.split(/\s+/)[0]?.toUpperCase() || ''
  if (header && header !== 'S1F12') warnings.push(`报文头为 ${header}，不是 S1F12；仍按 S1F12 结构尝试提取`)

  return {
    rows: extractRows(parsed.roots[0], warnings),
    warnings,
    diagnostics: parsed.diagnostics
  }
}

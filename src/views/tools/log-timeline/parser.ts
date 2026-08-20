import type { CeidMatchMode, RuleItem, SxFyRuleItem, TimelineItem } from './types'
import type { SecsLogDialect as LogDialect } from '../secs-log/types'
import {
  matchHeaderLine,
  matchStandaloneSfLine,
  matchTimePrefixLine
} from '../secs-log/log-dialect'
import {
  buildLogMessageBlocks,
  findBlockByLine,
  splitLogLines
} from '../secs-log/log-message-blocks'
import { getNodeAtPath, getNodeValueText, parseSmlTree, summarizeSmlDiagnostics } from '../secs-log/sml'

export { buildLogMessageBlocks, findBlockByLine, splitLogLines }

export function analyzeLogTimelineDetailed(
  logContent: string,
  rulesList: RuleItem[],
  sxfyList: SxFyRuleItem[],
  ceidMatchMode: CeidMatchMode = 'S6F11'
): import('./types').LogTimelineAnalysisResult {
  const ruleMap = new Map<string, string>()
  rulesList.forEach(rule => {
    if (rule.enabled !== false) {
      ruleMap.set(rule.ceid, rule.desc)
    }
  })

  const sxfyRuleMap = new Map<string, SxFyRuleItem[]>()
  sxfyList.forEach(rule => {
    if (rule.enabled === false) {
      return
    }

    const key = `S${rule.s}F${rule.f}`
    const rules = sxfyRuleMap.get(key)
    if (rules) {
      rules.push(rule)
      return
    }

    sxfyRuleMap.set(key, [rule])
  })

  const timeline: TimelineItem[] = []
  const diagnostics: import('./types').TimelineParseDiagnostic[] = []
  const lines = splitLogLines(logContent)
  const blocks = buildLogMessageBlocks(lines)
  let preferredDialect: LogDialect | null = null

  blocks.forEach(block => {
    const rawLines = lines.slice(block.startLine - 1, block.endLine)
    let time = ''
    let sfName = ''
    let pendingTime = ''
    for (const rawLine of rawLines) {
      const lineTrim = rawLine.trim()
      const headerMatch = matchHeaderLine(lineTrim, preferredDialect)
      const timePrefixMatch = matchTimePrefixLine(lineTrim, preferredDialect)
      const sfMatch = matchStandaloneSfLine(lineTrim, preferredDialect)
      if (headerMatch) {
        preferredDialect = headerMatch.dialect
        time = headerMatch.value.time
        sfName = headerMatch.value.sfName
        break
      }
      if (timePrefixMatch) {
        preferredDialect = timePrefixMatch.dialect
        pendingTime = timePrefixMatch.value
      } else if (sfMatch) {
        preferredDialect = sfMatch.dialect
        sfName = sfMatch.value
        time = pendingTime
        break
      }
    }
    if (!sfName) return
    const activeSxFyRules = sxfyRuleMap.get(sfName) || []
    activeSxFyRules.forEach(rule => {
      if (!rule.keyPos) {
        timeline.push({ time, sxFy: sfName, ceid: sfName, ruleId: rule.id, type: 'SxFy', desc: rule.desc || `匹配到 ${sfName} 消息`, line: block.contentStartLine })
      }
    })
    if (!activeSxFyRules.length && sfName !== ceidMatchMode) return
    const parsed = parseSmlTree(rawLines.join('\n'))
    parsed.diagnostics.forEach(diagnostic => {
      diagnostics.push({
        blockStartLine: block.startLine,
        line: block.startLine + diagnostic.line - 1,
        column: diagnostic.column,
        sfName,
        code: diagnostic.code,
        severity: diagnostic.severity,
        message: diagnostic.message
      })
    })
    if (!summarizeSmlDiagnostics(parsed).isUsable) return
    const ceidNode = sfName === ceidMatchMode ? getNodeAtPath(parsed.roots, [0, 1]) : undefined
    const ceidValue = getNodeValueText(ceidNode).replace(/^['"]|['"]$/g, '').trim()
    if (ceidValue && ruleMap.has(ceidValue)) {
      timeline.push({ time, sxFy: sfName, ceid: ceidValue, type: 'CEID', desc: ruleMap.get(ceidValue) || '', line: block.startLine + (ceidNode?.sourceRange?.startLine || 1) - 1 })
    }
    activeSxFyRules.forEach(rule => {
      if (!rule.keyPos) return
      const path = Array.from(rule.keyPos.matchAll(/\[(\d+)\]/g)).map(match => Number(match[1]))
      const node = getNodeAtPath(parsed.roots, path)
      if (!node) return
      const value = getNodeValueText(node).replace(/^['"]|['"]$/g, '').trim()
      timeline.push({ time, sxFy: sfName, ceid: `S${rule.s}F${rule.f} ${rule.keyPos}`, ruleId: rule.id, type: 'SxFy', desc: rule.desc ? `${rule.desc}: ${value}` : `值: ${value}`, line: block.startLine + (node.sourceRange?.startLine || 1) - 1 })
    })
  })

  return { timeline, diagnostics, messageCount: blocks.length }
}

export function analyzeLogTimeline(
  logContent: string,
  rulesList: RuleItem[],
  sxfyList: SxFyRuleItem[],
  ceidMatchMode: CeidMatchMode = 'S6F11'
) {
  return analyzeLogTimelineDetailed(logContent, rulesList, sxfyList, ceidMatchMode).timeline
}

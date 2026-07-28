import { countLines } from '../secs-log/text-metrics'
import type {
  SecsDiffItem,
  SecsDiffRenderRow,
  SecsLogDiffResult,
  SecsLogDiffStats,
  SecsLogMessage
} from './types'

function splitDisplayLines(text: string) {
  if (!text) {
    return []
  }

  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
}

function padLines(lines: string[], size: number) {
  const padded = lines.slice()
  while (padded.length < size) {
    padded.push('')
  }
  return padded
}

function buildRowText(leftRawText: string, rightRawText: string) {
  const leftLines = splitDisplayLines(leftRawText)
  const rightLines = splitDisplayLines(rightRawText)
  const rowLineCount = Math.max(1, leftLines.length, rightLines.length)

  return {
    baselineText: padLines(leftLines, rowLineCount).join('\n'),
    targetText: padLines(rightLines, rowLineCount).join('\n'),
    rowLineCount
  }
}

function getDiffStats(
  baselineSourceText: string,
  targetSourceText: string,
  baselineMessages: SecsLogMessage[],
  targetMessages: SecsLogMessage[],
  rows: SecsDiffRenderRow[]
): SecsLogDiffStats {
  return {
    baselineLines: countLines(baselineSourceText),
    targetLines: countLines(targetSourceText),
    baselineMessages: baselineMessages.length,
    targetMessages: targetMessages.length,
    totalRows: rows.length,
    diffRows: rows.filter(row => row.kind !== 'equal').length,
    added: rows.filter(row => row.kind === 'added').length,
    missing: rows.filter(row => row.kind === 'missing').length,
    changed: rows.filter(row => row.kind === 'changed').length,
    fieldChanged: rows.filter(row => row.kind === 'field_changed').length,
    ackError: rows.filter(row => row.kind === 'ack_error').length,
    unmatchedReply: rows.filter(row => row.kind === 'unmatched_reply').length,
    timingChanged: rows.filter(row => row.kind === 'timing_changed').length,
    parseError: rows.filter(row => row.kind === 'parse_error').length
  }
}

export function buildRenderResult(
  baselineSourceText: string,
  targetSourceText: string,
  baselineMessages: SecsLogMessage[],
  targetMessages: SecsLogMessage[],
  diffItems: SecsDiffItem[],
  warnings: string[]
): SecsLogDiffResult {
  const rows: SecsDiffRenderRow[] = []
  const baselineTextParts: string[] = []
  const targetTextParts: string[] = []
  let displayLine = 1

  diffItems.forEach(item => {
    const baselineRawText = item.baselineEvent?.rawText || ''
    const targetRawText = item.targetEvent?.rawText || ''
    const rowText = buildRowText(baselineRawText, targetRawText)
    const displayStartLine = displayLine
    const displayEndLine = displayLine + rowText.rowLineCount - 1

    rows.push({
      id: item.id,
      kind: item.kind,
      severity: item.severity,
      baselineMessageId: item.baselineEvent?.messageId,
      targetMessageId: item.targetEvent?.messageId,
      baselineText: rowText.baselineText,
      targetText: rowText.targetText,
      baselineOriginalLine: baselineMessages[item.baselineEvent?.index ?? -1]?.startLine,
      targetOriginalLine: targetMessages[item.targetEvent?.index ?? -1]?.startLine,
      baselineDisplayStartLine: displayStartLine,
      baselineDisplayEndLine: displayEndLine,
      targetDisplayStartLine: displayStartLine,
      targetDisplayEndLine: displayEndLine,
      title: item.title,
      detail: item.detail,
      baselineKey: item.baselineEvent?.key,
      targetKey: item.targetEvent?.key,
      fieldDiffs: item.fieldDiffs,
      semanticSummary: item.semanticSummary,
      transactionSummary: item.transactionSummary,
      ackSummary: item.ackSummary,
      timingSummary: item.timingSummary
    })

    baselineTextParts.push(rowText.baselineText)
    targetTextParts.push(rowText.targetText)
    displayLine = displayEndLine + 2
  })

  const resultRows = rows
  return {
    baselineText: baselineTextParts.join('\n\n'),
    targetText: targetTextParts.join('\n\n'),
    rows: resultRows,
    messages: {
      baseline: baselineMessages,
      target: targetMessages
    },
    stats: getDiffStats(baselineSourceText, targetSourceText, baselineMessages, targetMessages, resultRows),
    warnings
  }
}

import { countLines } from '../secs-log/text-metrics'
import type {
  SecsDiffItem,
  SecsDiffRenderRow,
  SecsLogDiffResult,
  SecsLogDiffKind,
  SecsLogDiffSide,
  SecsLogDiffStats,
  SecsLogMessage,
  SecsLogMessageMeta
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

function createInitialStats(
  baselineSourceText: string,
  targetSourceText: string,
  baselineMessages: SecsLogMessage[],
  targetMessages: SecsLogMessage[]
): SecsLogDiffStats {
  return {
    baselineLines: countLines(baselineSourceText),
    targetLines: countLines(targetSourceText),
    baselineMessages: baselineMessages.length,
    targetMessages: targetMessages.length,
    totalRows: 0,
    diffRows: 0,
    added: 0,
    missing: 0,
    changed: 0,
    fieldChanged: 0,
    ackError: 0,
    parseError: 0
  }
}

function countRenderedRow(stats: SecsLogDiffStats, kind: SecsLogDiffKind) {
  stats.totalRows += 1

  if (kind === 'equal') {
    return
  }

  stats.diffRows += 1
  if (kind === 'added') stats.added += 1
  if (kind === 'missing') stats.missing += 1
  if (kind === 'changed') stats.changed += 1
  if (kind === 'field_changed') stats.fieldChanged += 1
  if (kind === 'ack_error') stats.ackError += 1
  if (kind === 'parse_error') stats.parseError += 1
}

function toMessageMeta(message: SecsLogMessage): SecsLogMessageMeta {
  return {
    id: message.id,
    side: message.side,
    index: message.index,
    startLine: message.startLine,
    contentStartLine: message.contentStartLine,
    endLine: message.endLine,
    time: message.time,
    timeMs: message.timeMs,
    sf: message.sf,
    parseError: message.parseError
  }
}

function toMessageMetaMap(messages: SecsLogMessage[], side: SecsLogDiffSide) {
  return new Map(
    messages
      .filter(message => message.side === side)
      .map(message => [message.index, toMessageMeta(message)])
  )
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
  const stats = createInitialStats(baselineSourceText, targetSourceText, baselineMessages, targetMessages)
  const baselineMessageMetaMap = toMessageMetaMap(baselineMessages, 'baseline')
  const targetMessageMetaMap = toMessageMetaMap(targetMessages, 'target')
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
      ackSummary: item.ackSummary
    })

    baselineTextParts.push(rowText.baselineText)
    targetTextParts.push(rowText.targetText)
    countRenderedRow(stats, item.kind)
    displayLine = displayEndLine + 2
  })

  const resultRows = rows
  return {
    baselineText: baselineTextParts.join('\n\n'),
    targetText: targetTextParts.join('\n\n'),
    rows: resultRows,
    messages: {
      baseline: Array.from(baselineMessageMetaMap.values()),
      target: Array.from(targetMessageMetaMap.values())
    },
    stats,
    warnings
  }
}

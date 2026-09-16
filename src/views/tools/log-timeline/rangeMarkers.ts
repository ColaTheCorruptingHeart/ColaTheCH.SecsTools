import type { SecsLogDialect } from '../secs-log/types'
import type { LogMessageBlock, RangeMarkerKind, TimelineItem } from './types'
import { matchHeaderLine, matchStandaloneSfLine, matchTimePrefixLine } from '../secs-log/log-dialect'
import { splitLogLines } from '../secs-log/log-message-blocks'

interface RangeMarkerSelection {
  kind: RangeMarkerKind
  block: LogMessageBlock | null
}

interface MessageBlockSummary {
  time: string
  sxFy: string
}

const getBlockKey = (block: LogMessageBlock) => {
  return `${block.startLine}:${block.contentStartLine}:${block.endLine}`
}

const getMessageBlockSummary = (lines: string[], block: LogMessageBlock): MessageBlockSummary => {
  let preferredDialect: SecsLogDialect | null = null
  let pendingTime = ''

  for (const rawLine of lines.slice(block.startLine - 1, block.endLine)) {
    const lineTrim = rawLine.trim()
    const headerMatch = matchHeaderLine(lineTrim, preferredDialect)
    if (headerMatch) {
      return {
        time: headerMatch.value.time,
        sxFy: headerMatch.value.sfName
      }
    }

    const timePrefixMatch = matchTimePrefixLine(lineTrim, preferredDialect)
    if (timePrefixMatch) {
      preferredDialect = timePrefixMatch.dialect
      pendingTime = timePrefixMatch.value
      continue
    }

    const sfMatch = matchStandaloneSfLine(lineTrim, preferredDialect)
    if (sfMatch) {
      return {
        time: pendingTime,
        sxFy: sfMatch.value
      }
    }
  }

  return { time: '', sxFy: '' }
}

const getRangeMarkerDescription = (kinds: RangeMarkerKind[]) => {
  const labels = kinds.map(kind => kind === 'start' ? '区间起始点' : '区间结束点')
  return labels.join(' / ')
}

export const buildRangeMarkerTimeline = (
  items: TimelineItem[],
  logContent: string,
  selections: RangeMarkerSelection[],
  getBlockText?: (block: LogMessageBlock) => string
) => {
  const markerGroups = new Map<string, { block: LogMessageBlock, kinds: RangeMarkerKind[] }>()

  selections.forEach(({ kind, block }) => {
    if (!block) return

    const key = getBlockKey(block)
    const existing = markerGroups.get(key)
    if (existing) {
      if (!existing.kinds.includes(kind)) existing.kinds.push(kind)
      return
    }

    markerGroups.set(key, { block, kinds: [kind] })
  })

  if (!markerGroups.size) return items

  const markersByItemIndex = new Map<number, RangeMarkerKind[]>()
  const virtualMarkers: TimelineItem[] = []
  let fallbackLines: string[] | null = null

  markerGroups.forEach(({ block, kinds }) => {
    let matched = false

    items.forEach((item, index) => {
      if (item.line < block.startLine || item.line > block.endLine) return

      matched = true
      const existingKinds = markersByItemIndex.get(index) || []
      markersByItemIndex.set(index, Array.from(new Set([...existingKinds, ...kinds])))
    })

    if (matched) return

    if (!getBlockText && !fallbackLines) fallbackLines = splitLogLines(logContent)
    const blockLines = getBlockText
      ? splitLogLines(getBlockText(block))
      : (fallbackLines || []).slice(block.startLine - 1, block.endLine)
    const summary = getMessageBlockSummary(blockLines, {
      startLine: 1,
      contentStartLine: 1,
      endLine: blockLines.length
    })
    virtualMarkers.push({
      time: summary.time,
      sxFy: summary.sxFy,
      ceid: '',
      desc: getRangeMarkerDescription(kinds),
      line: block.startLine,
      type: 'RangeMarker',
      rangeMarkers: [...kinds]
    })
  })

  const markedItems = items.map((item, index) => {
    const rangeMarkers = markersByItemIndex.get(index)
    return rangeMarkers ? { ...item, rangeMarkers } : item
  })

  virtualMarkers.sort((left, right) => left.line - right.line)

  const result: TimelineItem[] = []
  let virtualIndex = 0
  markedItems.forEach(item => {
    while (true) {
      const virtualMarker = virtualMarkers[virtualIndex]
      if (!virtualMarker || virtualMarker.line > item.line) break

      result.push(virtualMarker)
      virtualIndex += 1
    }
    result.push(item)
  })

  result.push(...virtualMarkers.slice(virtualIndex))
  return result
}

import { buildLogMessageBlocks, splitLogLines } from '../secs-log/log-message-blocks'
import {
  matchHeaderLine,
  matchStandaloneSfLine,
  matchTimePrefixLine
} from '../secs-log/log-dialect'
import type { SecsLogDialect } from '../secs-log/types'
import type { SecsLogDiffSide, SecsLogMessage } from './types'

function extractMessageHeader(rawText: string) {
  const lines = splitLogLines(rawText)
  let preferredDialect: SecsLogDialect | null = null
  let pendingTime = ''

  for (const rawLine of lines) {
    const lineTrim = rawLine.trim()
    if (!lineTrim) {
      continue
    }

    const headerMatch = matchHeaderLine(lineTrim, preferredDialect)
    if (headerMatch) {
      preferredDialect = headerMatch.dialect
      return {
        time: headerMatch.value.time,
        sf: headerMatch.value.sfName
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
      preferredDialect = sfMatch.dialect
      return {
        time: pendingTime,
        sf: sfMatch.value
      }
    }
  }

  const sfMatch = rawText.match(/\bS\d+F\d+\b/i)
  return {
    time: '',
    sf: sfMatch?.[0]?.toUpperCase() || ''
  }
}

function parseLogTimeMs(time: string) {
  const match = time.match(/^(\d{2}):(\d{2}):(\d{2})\.(\d{3})$/)
  if (!match?.[1] || !match[2] || !match[3] || !match[4]) {
    return undefined
  }

  return (
    Number(match[1]) * 60 * 60 * 1000
    + Number(match[2]) * 60 * 1000
    + Number(match[3]) * 1000
    + Number(match[4])
  )
}

export function buildSecsLogMessages(logText: string, side: SecsLogDiffSide): SecsLogMessage[] {
  const lines = splitLogLines(logText)
  const blocks = buildLogMessageBlocks(lines)

  return blocks.map((block, index) => {
    const rawText = lines.slice(block.startLine - 1, block.endLine).join('\n')
    const header = extractMessageHeader(rawText)

    return {
      id: `${side}-${index + 1}`,
      side,
      index,
      startLine: block.startLine,
      contentStartLine: block.contentStartLine,
      endLine: block.endLine,
      time: header.time,
      timeMs: parseLogTimeMs(header.time),
      sf: header.sf,
      rawText,
      parseError: header.sf ? undefined : '未识别到 SxFy'
    }
  })
}

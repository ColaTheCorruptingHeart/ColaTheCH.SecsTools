import {
  matchHeaderLine,
  matchStandaloneSfLine,
  matchTimePrefixLine
} from './log-dialect'
import type { LogMessageBlock, SecsLogDialect } from './types'

export const splitLogLines = (content: string) => content.split(/\r?\n/)

export function buildLogMessageBlocks(lines: string[]) {
  const blocks: LogMessageBlock[] = []
  let currentStartLine = -1
  let currentContentStartLine = -1
  let pendingTimeLine = -1
  let preferredDialect: SecsLogDialect | null = null

  const finalizeCurrentBlock = (endLine: number) => {
    if (currentStartLine === -1 || currentContentStartLine === -1 || endLine < currentContentStartLine) {
      return
    }

    blocks.push({
      startLine: currentStartLine,
      contentStartLine: currentContentStartLine,
      endLine
    })
  }

  for (let index = 0; index < lines.length; index += 1) {
    const lineTrim = lines[index]?.trim() || ''
    if (!lineTrim) {
      continue
    }

    const currentLineNumber = index + 1
    const headerMatch = matchHeaderLine(lineTrim, preferredDialect)
    if (headerMatch) {
      preferredDialect = headerMatch.dialect
      finalizeCurrentBlock(index)
      currentStartLine = currentLineNumber
      currentContentStartLine = currentLineNumber
      pendingTimeLine = -1
      continue
    }

    const timePrefixMatch = matchTimePrefixLine(lineTrim, preferredDialect)
    if (timePrefixMatch) {
      preferredDialect = timePrefixMatch.dialect
      finalizeCurrentBlock(index)
      currentStartLine = -1
      currentContentStartLine = -1
      pendingTimeLine = currentLineNumber
      continue
    }

    const sfMatch = matchStandaloneSfLine(lineTrim, preferredDialect)
    if (sfMatch) {
      preferredDialect = sfMatch.dialect
      if (pendingTimeLine !== -1) {
        currentStartLine = pendingTimeLine
        currentContentStartLine = currentLineNumber
        pendingTimeLine = -1
      } else if (currentContentStartLine === -1) {
        currentStartLine = currentLineNumber
        currentContentStartLine = currentLineNumber
      }
    }
  }

  finalizeCurrentBlock(lines.length)
  return blocks
}

export function findBlockByLine(blocks: LogMessageBlock[], lineNumber: number) {
  for (const block of blocks) {
    if (lineNumber >= block.contentStartLine && lineNumber <= block.endLine) {
      return block
    }
  }

  return null
}

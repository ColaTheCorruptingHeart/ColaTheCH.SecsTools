import { buildLogMessageBlocks, findBlockByLine, splitLogLines } from './parser'
import type { ExportedMatchedBlock, LogMessageBlock, TimelineItem } from './types'

const EXPORT_HEADER_PATTERN = /(?:SEND|RECV)\s+((?:S\d+F\d+)(?::S\d+F\d+)*)\b(\s+W\b)?/i

export function normalizeExportIndentation(line: string) {
  const trimmedRight = line.replace(/\s+$/, '')
  const trimmed = trimmedRight.trimStart()

  if (!trimmed || (trimmed[0] !== '<' && trimmed[0] !== '>')) {
    return trimmedRight
  }

  const leadingWhitespace = trimmedRight.slice(0, trimmedRight.length - trimmed.length)
  const visualIndentWidth = leadingWhitespace.replace(/\t/g, '    ').length
  const indentLevel = visualIndentWidth > 0 ? Math.max(1, Math.round(visualIndentWidth / 4)) : 0

  return `${'  '.repeat(indentLevel)}${trimmed}`
}

function normalizeExportHeaderLine(line: string) {
  const trimmed = line.trim()
  if (!trimmed) {
    return ''
  }

  const headerMatch = trimmed.match(EXPORT_HEADER_PATTERN)
  if (!headerMatch?.[1]) {
    return trimmed
  }

  const sfName = headerMatch[1].match(/S\d+F\d+/i)?.[0]?.toUpperCase()
  if (!sfName) {
    return trimmed
  }

  return `${sfName}${headerMatch[2] ? ' W' : ''}`
}

function extractSxFyName(item: TimelineItem) {
  if (item.sxFy) {
    return item.sxFy
  }

  const match = item.ceid.match(/S\d+F\d+/)
  return match?.[0] || 'UnknownSxFy'
}

function normalizeFileNameSegment(value: string, fallback: string) {
  const normalized = value
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '')
    .trim()

  return normalized || fallback
}

export function buildExportedMatchedBlocks(logContent: string, timelineItems: TimelineItem[], includeTimeLine: boolean) {
  const lines = splitLogLines(logContent)
  const blocks = buildLogMessageBlocks(lines)
  const blockMap = new Map<number, { block: LogMessageBlock, items: TimelineItem[] }>()

  timelineItems.forEach(item => {
    const block = findBlockByLine(blocks, item.line)
    if (!block) {
      return
    }

    const uniqueKey = block.contentStartLine
    const existing = blockMap.get(uniqueKey)
    if (existing) {
      existing.items.push(item)
      return
    }

    blockMap.set(uniqueKey, {
      block,
      items: [item]
    })
  })

  const exportedBlocks: ExportedMatchedBlock[] = []

  blockMap.forEach(({ block, items }, uniqueKey) => {
    const namingItem = items.find(item => item.type === 'CEID') || items[0]
    if (!namingItem) {
      return
    }

    const exportStartLine = includeTimeLine ? block.startLine : block.contentStartLine
    const exportLines = lines.slice(exportStartLine - 1, block.endLine)

    if (!includeTimeLine && exportLines.length > 0) {
      exportLines[0] = normalizeExportHeaderLine(exportLines[0] || '')
    }

    const text = exportLines
      .map(normalizeExportIndentation)
      .join('\n')
      .trimEnd()

    if (!text) {
      return
    }

    const ceidItem = items.find(item => item.type === 'CEID')
    exportedBlocks.push({
      uniqueKey,
      block,
      items,
      sxFy: extractSxFyName(namingItem),
      desc: namingItem.desc,
      ceid: ceidItem?.ceid || '',
      text
    })
  })

  return exportedBlocks
}

export function buildCommandFileBaseName(block: ExportedMatchedBlock) {
  const segments = [
    normalizeFileNameSegment(block.sxFy, 'UnknownSxFy'),
    normalizeFileNameSegment(block.desc, '未命名')
  ]

  if (block.ceid) {
    segments.push(normalizeFileNameSegment(block.ceid, 'CEID'))
  }

  return segments.join('_')
}

export function buildUniqueFileName(baseName: string, nameCounter: Map<string, number>) {
  const currentCount = nameCounter.get(baseName) || 0
  nameCounter.set(baseName, currentCount + 1)

  if (currentCount === 0) {
    return `${baseName}.txt`
  }

  return `${baseName}_${String(currentCount).padStart(3, '0')}.txt`
}

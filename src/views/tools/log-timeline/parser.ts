import type { CeidMatchMode, LogMessageBlock, RuleItem, SxFyRuleItem, TimelineItem } from './types'

interface MessageHeaderMatch {
  time: string
  sfName: string
}

interface LogDialect {
  id: string
  matchHeaderLine: (lineTrim: string) => MessageHeaderMatch | null
  matchStandaloneSfLine: (lineTrim: string) => string | null
  matchTimePrefixLine: (lineTrim: string) => string | null
}

interface DialectMatch<T> {
  dialect: LogDialect
  value: T
}

const STANDALONE_SF_PATTERN = /^(S\d+F\d+)(?:\s+W)?$/i
const LEGACY_HEADER_PATTERN = /^(\d{2}:\d{2}:\d{2}\.\d{3})\s+(?:SEND|RECV)\s+((?:S\d+F\d+)(?::S\d+F\d+)*)\b/i
const LEGACY_TIME_PREFIX_PATTERN = /^(?:\d{4}-\d{2}-\d{2}\s+)?(\d{2}:\d{2}:\d{2}\.\d{3})/
const BRACKET_HEADER_PATTERN = /^\[(?:\d{4}-\d{2}-\d{2}\s+)?(\d{2}:\d{2}:\d{2}\.\d{3})\]\s+(?:SEND|RECV)\s+((?:S\d+F\d+)(?::S\d+F\d+)*)\b/i
const BRACKET_TIME_PREFIX_PATTERN = /^\[(?:\d{4}-\d{2}-\d{2}\s+)?(\d{2}:\d{2}:\d{2}\.\d{3})\]/

function normalizeSfName(rawValue: string) {
  const match = rawValue.match(/S\d+F\d+/i)
  return match?.[0]?.toUpperCase() || ''
}

function createHeaderMatcher(pattern: RegExp) {
  return (lineTrim: string): MessageHeaderMatch | null => {
    const match = lineTrim.match(pattern)
    if (!match?.[1] || !match[2]) {
      return null
    }

    const sfName = normalizeSfName(match[2])
    if (!sfName) {
      return null
    }

    return {
      time: match[1],
      sfName
    }
  }
}

function createTimePrefixMatcher(pattern: RegExp) {
  return (lineTrim: string) => {
    const match = lineTrim.match(pattern)
    return match?.[1] || null
  }
}

function matchStandaloneSfValue(lineTrim: string) {
  const match = lineTrim.match(STANDALONE_SF_PATTERN)
  return match?.[1]?.toUpperCase() || null
}

const logDialects: LogDialect[] = [
  {
    id: 'bracket-timestamp',
    matchHeaderLine: createHeaderMatcher(BRACKET_HEADER_PATTERN),
    matchStandaloneSfLine: matchStandaloneSfValue,
    matchTimePrefixLine: createTimePrefixMatcher(BRACKET_TIME_PREFIX_PATTERN)
  },
  {
    id: 'legacy-inline',
    matchHeaderLine: createHeaderMatcher(LEGACY_HEADER_PATTERN),
    matchStandaloneSfLine: matchStandaloneSfValue,
    matchTimePrefixLine: createTimePrefixMatcher(LEGACY_TIME_PREFIX_PATTERN)
  }
]

function getOrderedDialects(preferredDialect: LogDialect | null) {
  if (!preferredDialect) {
    return logDialects
  }

  return [preferredDialect, ...logDialects.filter(dialect => dialect !== preferredDialect)]
}

function matchWithDialects<T>(
  lineTrim: string,
  preferredDialect: LogDialect | null,
  matcher: (dialect: LogDialect, line: string) => T | null
): DialectMatch<T> | null {
  for (const dialect of getOrderedDialects(preferredDialect)) {
    const value = matcher(dialect, lineTrim)
    if (value !== null) {
      return { dialect, value }
    }
  }

  return null
}

function matchHeaderLine(lineTrim: string, preferredDialect: LogDialect | null) {
  return matchWithDialects(lineTrim, preferredDialect, (dialect, line) => dialect.matchHeaderLine(line))
}

function matchStandaloneSfLine(lineTrim: string, preferredDialect: LogDialect | null) {
  return matchWithDialects(lineTrim, preferredDialect, (dialect, line) => dialect.matchStandaloneSfLine(line))
}

function matchTimePrefixLine(lineTrim: string, preferredDialect: LogDialect | null) {
  return matchWithDialects(lineTrim, preferredDialect, (dialect, line) => dialect.matchTimePrefixLine(line))
}

const CEID_KEY_POSITION = '[0][1]'

export const splitLogLines = (content: string) => content.split(/\r?\n/)

function extractValueFromDataLine(lineTrim: string) {
  const quotedMatch = lineTrim.match(/['"](.*?)['"]/)
  if (quotedMatch && quotedMatch[1] !== undefined) {
    return quotedMatch[1]
  }

  const typeMatcher = lineTrim.match(/<[^>\s]+\s+(?:\[.*?\]\s+)?(.*?)>/)
  if (typeMatcher && typeMatcher[1] !== undefined) {
    return typeMatcher[1].trim()
  }

  return lineTrim.replace(/<|>/g, '').trim()
}

export function buildLogMessageBlocks(lines: string[]) {
  const blocks: LogMessageBlock[] = []
  let currentStartLine = -1
  let currentContentStartLine = -1
  let pendingTimeLine = -1
  let preferredDialect: LogDialect | null = null

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

export function analyzeLogTimeline(logContent: string, rulesList: RuleItem[], sxfyList: SxFyRuleItem[], ceidMatchMode: CeidMatchMode = 'S6F11') {
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

  const lines = splitLogLines(logContent)
  const timeline: TimelineItem[] = []

  let activeCeidSxFy = ''
  let activeCeidTime = ''
  let currentPath: number[] = []

  let activeSxFyRules: SxFyRuleItem[] = []
  let sxFyBlockTime = ''
  let pendingTime = ''
  let preferredDialect: LogDialect | null = null

  const resetActiveStructuredState = () => {
    activeCeidSxFy = ''
    activeCeidTime = ''
    activeSxFyRules = []
    currentPath = []
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (typeof line !== 'string') {
      continue
    }

    const lineTrim = line.trim()
    if (!lineTrim) {
      continue
    }

    const firstChar = lineTrim[0]
    if (firstChar === '<' || firstChar === '>') {
      if (activeCeidSxFy || activeSxFyRules.length > 0) {
        if (lineTrim.startsWith('<L')) {
          if (currentPath.length === 0) {
            currentPath.push(0)
          } else {
            currentPath[currentPath.length - 1] = (currentPath[currentPath.length - 1] || 0) + 1
          }
          currentPath.push(-1)
        } else if (lineTrim.startsWith('>')) {
          currentPath.pop()
          if (currentPath.length <= 1) {
            resetActiveStructuredState()
          }
        } else {
          if (currentPath.length === 0) {
            currentPath.push(0)
          } else {
            currentPath[currentPath.length - 1] = (currentPath[currentPath.length - 1] || 0) + 1
          }

          const currentPathStr = `[${currentPath.join('][')}]`
          const value = extractValueFromDataLine(lineTrim)

          if (activeCeidSxFy && currentPathStr === CEID_KEY_POSITION && ruleMap.has(value)) {
            timeline.push({
              time: activeCeidTime,
              sxFy: activeCeidSxFy,
              ceid: value,
              type: 'CEID',
              desc: ruleMap.get(value) || '',
              line: index + 1
            })
          }

          if (activeSxFyRules.length > 0) {
            activeSxFyRules.forEach(rule => {
              if (rule.keyPos && rule.keyPos === currentPathStr) {
                timeline.push({
                  time: sxFyBlockTime,
                  sxFy: `S${rule.s}F${rule.f}`,
                  ceid: `S${rule.s}F${rule.f} ${rule.keyPos}`,
                  ruleId: rule.id,
                  type: 'SxFy',
                  desc: rule.desc ? `${rule.desc}: ${value}` : `值: ${value}`,
                  line: index + 1
                })
              }
            })
          }
        }
      }

      continue
    }

    const headerMatch = matchHeaderLine(lineTrim, preferredDialect)
    const sfMatch = matchStandaloneSfLine(lineTrim, preferredDialect)
    const timePrefixMatch = matchTimePrefixLine(lineTrim, preferredDialect)

    let time = ''
    let sfName = ''

    if (headerMatch) {
      preferredDialect = headerMatch.dialect
      time = headerMatch.value.time
      sfName = headerMatch.value.sfName
      pendingTime = ''
    } else if (sfMatch && pendingTime) {
      preferredDialect = sfMatch.dialect
      time = pendingTime
      sfName = sfMatch.value
      pendingTime = ''
    } else if (timePrefixMatch) {
      preferredDialect = timePrefixMatch.dialect
      pendingTime = timePrefixMatch.value
      if (activeCeidSxFy || activeSxFyRules.length > 0) {
        resetActiveStructuredState()
      }
      continue
    }

    if (!time || !sfName) {
      continue
    }

    currentPath = []
    activeSxFyRules = sxfyRuleMap.get(sfName) || []

    if (sfName === ceidMatchMode) {
      activeCeidSxFy = sfName
      activeCeidTime = time
    } else {
      activeCeidSxFy = ''
      activeCeidTime = ''
    }

    if (activeSxFyRules.length > 0) {
      sxFyBlockTime = time
      activeSxFyRules.forEach(rule => {
        if (!rule.keyPos) {
          timeline.push({
            time,
            sxFy: sfName,
            ceid: sfName,
            ruleId: rule.id,
            type: 'SxFy',
            desc: rule.desc || `匹配到 ${sfName} 消息`,
            line: index + 1
          })
        }
      })
    }
  }

  return timeline
}

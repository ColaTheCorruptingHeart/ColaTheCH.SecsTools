import type { CeidMatchMode, LogMessageBlock, RuleItem, SxFyRuleItem, TimelineItem } from './types'

export const matchHeaderLine = (lineTrim: string) => lineTrim.match(/^(\d{2}:\d{2}:\d{2}\.\d{3})\s+(?:SEND|RECV)\s+(S\d+F\d+)/i)
export const matchStandaloneSfLine = (lineTrim: string) => lineTrim.match(/^(S\d+F\d+)(?:\s+W)?$/i)
export const matchTimePrefixLine = (lineTrim: string) => lineTrim.match(/^(?:\d{4}-\d{2}-\d{2}\s+)?(\d{2}:\d{2}:\d{2}\.\d{3})/)

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
    const headerMatch = matchHeaderLine(lineTrim)
    if (headerMatch) {
      finalizeCurrentBlock(index)
      currentStartLine = currentLineNumber
      currentContentStartLine = currentLineNumber
      pendingTimeLine = -1
      continue
    }

    const timePrefixMatch = matchTimePrefixLine(lineTrim)
    if (timePrefixMatch) {
      finalizeCurrentBlock(index)
      currentStartLine = -1
      currentContentStartLine = -1
      pendingTimeLine = currentLineNumber
      continue
    }

    const sfMatch = matchStandaloneSfLine(lineTrim)
    if (sfMatch) {
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

    const headerMatch = matchHeaderLine(lineTrim)
    const sfMatch = matchStandaloneSfLine(lineTrim)
    const timePrefixMatch = matchTimePrefixLine(lineTrim)

    let time = ''
    let sfName = ''

    if (headerMatch && headerMatch[1] && headerMatch[2]) {
      time = headerMatch[1]
      sfName = headerMatch[2].toUpperCase()
      pendingTime = ''
    } else if (sfMatch && sfMatch[1] && pendingTime) {
      time = pendingTime
      sfName = sfMatch[1].toUpperCase()
      pendingTime = ''
    } else if (timePrefixMatch && timePrefixMatch[1]) {
      pendingTime = timePrefixMatch[1]
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

import type { CeidMatchMode, RuleItem, SxFyRuleItem, TimelineItem } from './types'
import type { SecsLogDialect as LogDialect } from '../secs-log/types'
import {
  extractValueFromDataLine,
  matchHeaderLine,
  matchStandaloneSfLine,
  matchTimePrefixLine
} from '../secs-log/log-dialect'
import {
  buildLogMessageBlocks,
  findBlockByLine,
  splitLogLines
} from '../secs-log/log-message-blocks'

const CEID_KEY_POSITION = '[0][1]'

export { buildLogMessageBlocks, findBlockByLine, splitLogLines }

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

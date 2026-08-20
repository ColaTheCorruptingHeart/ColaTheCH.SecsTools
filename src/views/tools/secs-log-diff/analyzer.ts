import { countLines } from '../secs-log/text-metrics'
import { SECS_LOG_DIFF_LIMITS } from './config'
import { diffEventSequences } from './diff'
import { buildSecsLogMessages } from './parser'
import { buildRenderResult } from './render'
import { buildSemanticEvents } from './semantic'
import type { SecsLogDiffOptions } from './types'

function getTextByteSize(text: string) {
  return new Blob([text]).size
}

function validateInputSize(baselineText: string, targetText: string) {
  const baselineBytes = getTextByteSize(baselineText)
  const targetBytes = getTextByteSize(targetText)

  if (baselineBytes > SECS_LOG_DIFF_LIMITS.hardTextBytes || targetBytes > SECS_LOG_DIFF_LIMITS.hardTextBytes) {
    throw new Error(`单份日志超过 ${SECS_LOG_DIFF_LIMITS.hardTextBytes / 1024 / 1024} MB 限制`)
  }

  const warnings: string[] = []
  if (baselineBytes > SECS_LOG_DIFF_LIMITS.softTextBytes || targetBytes > SECS_LOG_DIFF_LIMITS.softTextBytes) {
    warnings.push('日志体积较大，已启用有限窗口消息对齐')
  }

  return warnings
}

export function analyzeSecsLogDiff(
  baselineText: string,
  targetText: string,
  options: SecsLogDiffOptions
) {
  const warnings = validateInputSize(baselineText, targetText)
  const baselineMessages = buildSecsLogMessages(baselineText, 'baseline')
  const targetMessages = buildSecsLogMessages(targetText, 'target')

  if (baselineMessages.length > SECS_LOG_DIFF_LIMITS.hardMessageCount || targetMessages.length > SECS_LOG_DIFF_LIMITS.hardMessageCount) {
    throw new Error(`单份日志消息数超过 ${SECS_LOG_DIFF_LIMITS.hardMessageCount.toLocaleString()} 条限制`)
  }

  if (baselineMessages.length > SECS_LOG_DIFF_LIMITS.softMessageCount || targetMessages.length > SECS_LOG_DIFF_LIMITS.softMessageCount) {
    warnings.push('消息数量较多，建议使用差异过滤和导航定位')
  }

  if (!baselineMessages.length && countLines(baselineText) > 0) {
    warnings.push('baseline 未识别到 SECS 消息块')
  }

  if (!targetMessages.length && countLines(targetText) > 0) {
    warnings.push('target 未识别到 SECS 消息块')
  }

  const baselineEvents = buildSemanticEvents(baselineMessages, options.profile)
  const targetEvents = buildSemanticEvents(targetMessages, options.profile)

  const smlWarningCount = [...baselineEvents, ...targetEvents]
    .reduce((count, event) => count + (event.parseWarnings?.length || 0), 0)
  if (smlWarningCount) {
    warnings.push(`发现 ${smlWarningCount.toLocaleString()} 项可恢复的 SML 解析警告，差异结果已按恢复后的结构生成`)
  }

  const diffItems = diffEventSequences(baselineEvents, targetEvents, options)

  return buildRenderResult(
    baselineText,
    targetText,
    baselineMessages,
    targetMessages,
    diffItems,
    warnings
  )
}

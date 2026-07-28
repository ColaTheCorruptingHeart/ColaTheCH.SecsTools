import { getAckSeverity, getAckSummary } from './ack'
import { diffEventAttributes } from './field-diff'
import type {
  SecsDiffItem,
  SecsFieldDiff,
  SecsLogDiffKind,
  SecsLogDiffOptions,
  SecsLogDiffSeverity,
  SecsSemanticEvent
} from './types'

function normalizeRawText(text: string) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .join('\n')
}

function hasRuleIdentityKey(event: SecsSemanticEvent) {
  return Boolean(event.key && event.sf && event.key !== event.sf)
}

function scoreEventMatch(baseline: SecsSemanticEvent, target: SecsSemanticEvent, distance: number) {
  if (hasRuleIdentityKey(baseline) && hasRuleIdentityKey(target) && baseline.key !== target.key) {
    return -1
  }

  let score = 0

  if (baseline.key && baseline.key === target.key) {
    score += 100
  }

  if (baseline.sf && baseline.sf === target.sf) {
    score += 40
  }

  if (baseline.type === target.type) {
    score += 20
  }

  score += Math.max(0, 10 - distance)
  return score
}

function getDiffSeverity(
  kind: SecsLogDiffKind,
  baselineEvent: SecsSemanticEvent | undefined,
  targetEvent: SecsSemanticEvent | undefined
): SecsLogDiffSeverity {
  const configuredSeverity = targetEvent?.ruleSeverity?.[kind] || baselineEvent?.ruleSeverity?.[kind]
  if (configuredSeverity) {
    return configuredSeverity
  }

  if (kind === 'ack_error') {
    const baselineSeverity = getAckSeverity(baselineEvent)
    const targetSeverity = getAckSeverity(targetEvent)
    return baselineSeverity === 'critical' || targetSeverity === 'critical' ? 'critical' : 'major'
  }

  if (kind === 'added' || kind === 'missing' || kind === 'parse_error' || kind === 'unmatched_reply') {
    return 'major'
  }

  if (kind === 'timing_changed') {
    const baselineLatency = baselineEvent?.transaction?.latencyMs
    const targetLatency = targetEvent?.transaction?.latencyMs
    if (baselineLatency !== undefined && targetLatency !== undefined && Math.abs(targetLatency - baselineLatency) >= 5000) {
      return 'major'
    }
    return 'minor'
  }

  if (kind === 'changed' || kind === 'field_changed') {
    return 'minor'
  }

  return 'info'
}

function createDiffItem(
  id: string,
  kind: SecsLogDiffKind,
  baselineEvent: SecsSemanticEvent | undefined,
  targetEvent: SecsSemanticEvent | undefined,
  fieldDiffs: SecsFieldDiff[] = []
): SecsDiffItem {
  const event = baselineEvent || targetEvent
  const baselineLabel = baselineEvent?.summary || baselineEvent?.key || ''
  const targetLabel = targetEvent?.summary || targetEvent?.key || ''

  const titleByKind: Record<SecsLogDiffKind, string> = {
    equal: baselineLabel || targetLabel || '消息一致',
    added: `新增 ${targetLabel || event?.sf || '消息'}`,
    missing: `缺失 ${baselineLabel || event?.sf || '消息'}`,
    changed: `${baselineLabel || event?.sf || '消息'} 原文变化`,
    field_changed: `${baselineLabel || event?.sf || '消息'} 字段变化`,
    ack_error: `${baselineLabel || targetLabel || event?.sf || '消息'} ACK 异常`,
    unmatched_reply: `${baselineLabel || targetLabel || event?.sf || '消息'} 回复缺失`,
    timing_changed: `${baselineLabel || targetLabel || event?.sf || '消息'} 时序变化`,
    parse_error: `${baselineLabel || targetLabel || event?.sf || '消息'} 解析失败`
  }

  const detailByKind: Record<SecsLogDiffKind, string> = {
    equal: '两侧消息按当前规则匹配一致。',
    added: 'target 日志包含该消息，baseline 中没有匹配消息。',
    missing: 'baseline 日志包含该消息，target 中没有匹配消息。',
    changed: '两侧消息已匹配，但原文内容发生变化。',
    field_changed: '两侧消息已匹配，但配置的比较字段发生变化。',
    ack_error: getAckSummary(baselineEvent) || getAckSummary(targetEvent) || 'ACK 值不属于成功值。',
    unmatched_reply: baselineEvent?.transaction?.summary || targetEvent?.transaction?.summary || '请求没有匹配到回复消息。',
    timing_changed: getTimingDiffSummary(baselineEvent, targetEvent),
    parse_error: baselineEvent?.parseError || targetEvent?.parseError || '消息解析失败。'
  }

  return {
    id,
    kind,
    severity: getDiffSeverity(kind, baselineEvent, targetEvent),
    baselineEvent,
    targetEvent,
    title: titleByKind[kind],
    detail: detailByKind[kind],
    fieldDiffs,
    semanticSummary: baselineEvent?.summary || targetEvent?.summary,
    transactionSummary: baselineEvent?.transaction?.summary || targetEvent?.transaction?.summary,
    ackSummary: getAckSummary(baselineEvent) || getAckSummary(targetEvent),
    timingSummary: getTimingDiffSummary(baselineEvent, targetEvent)
  }
}

function formatLatency(latencyMs: number) {
  if (latencyMs >= 1000) {
    return `${(latencyMs / 1000).toFixed(3)}s`
  }

  return `${latencyMs}ms`
}

function getTimingDiffSummary(baseline: SecsSemanticEvent | undefined, target: SecsSemanticEvent | undefined) {
  const baselineLatency = baseline?.transaction?.latencyMs
  const targetLatency = target?.transaction?.latencyMs
  if (baselineLatency === undefined && targetLatency === undefined) {
    return baseline?.transaction?.timingSummary || target?.transaction?.timingSummary || ''
  }

  if (baselineLatency === undefined) {
    return `baseline 缺少时序信息，target ${formatLatency(targetLatency ?? 0)}`
  }

  if (targetLatency === undefined) {
    return `baseline ${formatLatency(baselineLatency)}，target 缺少时序信息`
  }

  const delta = targetLatency - baselineLatency
  const sign = delta >= 0 ? '+' : '-'
  return `baseline ${formatLatency(baselineLatency)}，target ${formatLatency(targetLatency)}，差值 ${sign}${formatLatency(Math.abs(delta))}`
}

function hasTimingChange(baseline: SecsSemanticEvent, target: SecsSemanticEvent) {
  const baselineLatency = baseline.transaction?.latencyMs
  const targetLatency = target.transaction?.latencyMs
  if (baselineLatency === undefined || targetLatency === undefined) {
    return false
  }

  const delta = Math.abs(targetLatency - baselineLatency)
  const base = Math.max(1, baselineLatency)
  return delta >= 1000 && delta / base >= 0.2
}

function classifyMatchedItem(baseline: SecsSemanticEvent, target: SecsSemanticEvent, score: number) {
  if (baseline.type === 'parse_error' || target.type === 'parse_error') {
    return 'parse_error'
  }

  if ((baseline.ack && !baseline.ack.ok) || (target.ack && !target.ack.ok)) {
    return 'ack_error'
  }

  if (baseline.transaction?.result === 'missing_reply' || target.transaction?.result === 'missing_reply') {
    return 'unmatched_reply'
  }

  if (score < 100) {
    return 'changed'
  }

  const shouldCompareFields = baseline.diffMode === 'field' || target.diffMode === 'field'
  if (shouldCompareFields && diffEventAttributes(baseline, target).length > 0) {
    return 'field_changed'
  }

  if (hasTimingChange(baseline, target)) {
    return 'timing_changed'
  }

  const shouldCompareRaw = baseline.diffMode === 'raw' || target.diffMode === 'raw'
  if (shouldCompareRaw && normalizeRawText(baseline.rawText) !== normalizeRawText(target.rawText)) {
    return 'changed'
  }

  return 'equal'
}

function getMatchedFieldDiffs(kind: SecsLogDiffKind, baselineEvent: SecsSemanticEvent, targetEvent: SecsSemanticEvent) {
  if (kind === 'field_changed' || kind === 'ack_error' || kind === 'changed' || kind === 'timing_changed') {
    return diffEventAttributes(baselineEvent, targetEvent)
  }

  return []
}

export function diffEventSequences(
  baselineEvents: SecsSemanticEvent[],
  targetEvents: SecsSemanticEvent[],
  options: SecsLogDiffOptions
) {
  const result: SecsDiffItem[] = []
  let baselineIndex = 0
  let targetIndex = 0

  const pushAddedUntil = (exclusiveTargetIndex: number) => {
    while (targetIndex < exclusiveTargetIndex) {
      const targetEvent = targetEvents[targetIndex]
      if (targetEvent) {
        result.push(createDiffItem(`diff-${result.length + 1}`, 'added', undefined, targetEvent))
      }
      targetIndex += 1
    }
  }

  while (baselineIndex < baselineEvents.length && targetIndex < targetEvents.length) {
    const baselineEvent = baselineEvents[baselineIndex]
    if (!baselineEvent) {
      baselineIndex += 1
      continue
    }

    let bestIndex = -1
    let bestScore = -1
    const searchEnd = Math.min(targetEvents.length, targetIndex + Math.max(1, options.matchWindowSize))

    for (let candidateIndex = targetIndex; candidateIndex < searchEnd; candidateIndex += 1) {
      const targetEvent = targetEvents[candidateIndex]
      if (!targetEvent) {
        continue
      }

      const score = scoreEventMatch(baselineEvent, targetEvent, candidateIndex - targetIndex)
      if (score > bestScore) {
        bestScore = score
        bestIndex = candidateIndex
      }
    }

    if (bestIndex === -1 || bestScore < 60) {
      result.push(createDiffItem(`diff-${result.length + 1}`, 'missing', baselineEvent, undefined))
      baselineIndex += 1
      continue
    }

    pushAddedUntil(bestIndex)

    const targetEvent = targetEvents[bestIndex]
    if (!targetEvent) {
      baselineIndex += 1
      targetIndex = bestIndex + 1
      continue
    }

    const kind = classifyMatchedItem(baselineEvent, targetEvent, bestScore)
    if (kind !== 'equal' || options.includeEqualRows) {
      result.push(
        createDiffItem(
          `diff-${result.length + 1}`,
          kind,
          baselineEvent,
          targetEvent,
          getMatchedFieldDiffs(kind, baselineEvent, targetEvent)
        )
      )
    }

    baselineIndex += 1
    targetIndex = bestIndex + 1
  }

  while (baselineIndex < baselineEvents.length) {
    const baselineEvent = baselineEvents[baselineIndex]
    if (baselineEvent) {
      result.push(createDiffItem(`diff-${result.length + 1}`, 'missing', baselineEvent, undefined))
    }
    baselineIndex += 1
  }

  while (targetIndex < targetEvents.length) {
    const targetEvent = targetEvents[targetIndex]
    if (targetEvent) {
      result.push(createDiffItem(`diff-${result.length + 1}`, 'added', undefined, targetEvent))
    }
    targetIndex += 1
  }

  return result
}

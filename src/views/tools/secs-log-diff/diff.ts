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

interface MatchedClassification {
  kind: SecsLogDiffKind
  fieldDiffs: SecsFieldDiff[]
}

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

  if (kind === 'added' || kind === 'missing' || kind === 'parse_error') {
    return 'major'
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
    parse_error: `${baselineLabel || targetLabel || event?.sf || '消息'} 解析失败`
  }

  const detailByKind: Record<SecsLogDiffKind, string> = {
    equal: '两侧消息按当前规则匹配一致。',
    added: 'target 日志包含该消息，baseline 中没有匹配消息。',
    missing: 'baseline 日志包含该消息，target 中没有匹配消息。',
    changed: '两侧消息已匹配，但原文内容发生变化。',
    field_changed: '两侧消息已匹配，但配置的比较字段发生变化。',
    ack_error: getAckSummary(baselineEvent) || getAckSummary(targetEvent) || 'ACK 值不属于成功值。',
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
    ackSummary: getAckSummary(baselineEvent) || getAckSummary(targetEvent)
  }
}

function classifyMatchedItem(baseline: SecsSemanticEvent, target: SecsSemanticEvent, score: number): MatchedClassification {
  if (baseline.type === 'parse_error' || target.type === 'parse_error') {
    return { kind: 'parse_error', fieldDiffs: [] }
  }

  if ((baseline.ack && !baseline.ack.ok) || (target.ack && !target.ack.ok)) {
    return { kind: 'ack_error', fieldDiffs: diffEventAttributes(baseline, target) }
  }

  if (score < 100) {
    return { kind: 'changed', fieldDiffs: diffEventAttributes(baseline, target) }
  }

  const shouldCompareFields = baseline.diffMode === 'field' || target.diffMode === 'field'
  if (shouldCompareFields) {
    const fieldDiffs = diffEventAttributes(baseline, target)
    if (fieldDiffs.length > 0) {
      return { kind: 'field_changed', fieldDiffs }
    }
  }

  const shouldCompareRaw = baseline.diffMode === 'raw' || target.diffMode === 'raw'
  if (shouldCompareRaw && normalizeRawText(baseline.rawText) !== normalizeRawText(target.rawText)) {
    return { kind: 'changed', fieldDiffs: diffEventAttributes(baseline, target) }
  }

  return { kind: 'equal', fieldDiffs: [] }
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

    const classification = classifyMatchedItem(baselineEvent, targetEvent, bestScore)
    if (classification.kind !== 'equal' || options.includeEqualRows) {
      result.push(
        createDiffItem(
          `diff-${result.length + 1}`,
          classification.kind,
          baselineEvent,
          targetEvent,
          classification.fieldDiffs
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

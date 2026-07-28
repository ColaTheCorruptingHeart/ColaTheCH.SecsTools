import type { AckRule, SecsLogDiffSeverity, SecsSemanticEvent } from './types'

const DEFAULT_ACK_MEANING: Record<string, Record<string, string>> = {
  HCACK: {
    '0': 'accepted'
  },
  ACKC6: {
    '0': 'accepted'
  },
  ACKC5: {
    '0': 'accepted'
  }
}

export function evaluateAck(rule: AckRule, value: string) {
  const normalizedValue = value.trim()
  const ok = rule.successValues.includes(normalizedValue)
  const meaning = DEFAULT_ACK_MEANING[rule.field]?.[normalizedValue] || (ok ? 'accepted' : 'not accepted')

  return {
    field: rule.field,
    value: normalizedValue,
    ok,
    meaning
  }
}

export function getAckSeverity(event: SecsSemanticEvent | undefined): SecsLogDiffSeverity {
  if (!event?.ack || event.ack.ok) {
    return 'info'
  }

  if (event.ack.field === 'HCACK') {
    return 'critical'
  }

  return 'major'
}

export function getAckSummary(event: SecsSemanticEvent | undefined) {
  if (!event?.ack) {
    return ''
  }

  return `${event.ack.field}=${event.ack.value} ${event.ack.ok ? 'OK' : 'NG'}`
}

import type { SecsSemanticEvent } from './types'

const TRANSACTION_REPLY_WINDOW = 8

const requestReplyMap: Record<string, { replySf: string, type: string }> = {
  S2F41: { replySf: 'S2F42', type: 'remote_command' },
  S6F11: { replySf: 'S6F12', type: 'event_report' },
  S5F1: { replySf: 'S5F2', type: 'alarm_report' }
}

function getTransactionKey(event: SecsSemanticEvent) {
  if (event.sf === 'S2F41') {
    return event.attributes.RCMD || event.key
  }

  if (event.sf === 'S6F11') {
    return event.attributes.CEID || event.key
  }

  if (event.sf === 'S5F1') {
    return event.attributes.ALID || event.key
  }

  return event.key
}

function getReplySummary(request: SecsSemanticEvent, reply: SecsSemanticEvent | undefined) {
  const timingSummary = getLatencySummary(request, reply)
  if (!reply) {
    return `${request.summary} -> missing reply`
  }

  if (reply.ack) {
    return `${request.summary} -> ${reply.sf} ${reply.ack.field}=${reply.ack.value}${timingSummary ? ` (${timingSummary})` : ''}`
  }

  return `${request.summary} -> ${reply.summary}${timingSummary ? ` (${timingSummary})` : ''}`
}

function resolveLatencyMs(request: SecsSemanticEvent, reply: SecsSemanticEvent | undefined) {
  if (request.timeMs === undefined || reply?.timeMs === undefined) {
    return undefined
  }

  const directLatency = reply.timeMs - request.timeMs
  return directLatency >= 0 ? directLatency : directLatency + 24 * 60 * 60 * 1000
}

function getLatencySummary(request: SecsSemanticEvent, reply: SecsSemanticEvent | undefined) {
  const latencyMs = resolveLatencyMs(request, reply)
  if (latencyMs === undefined) {
    return ''
  }

  if (latencyMs >= 1000) {
    return `${(latencyMs / 1000).toFixed(3)}s`
  }

  return `${latencyMs}ms`
}

export function attachTransactions(events: SecsSemanticEvent[]) {
  const usedReplyIndexes = new Set<number>()

  events.forEach((event, index) => {
    const mapping = requestReplyMap[event.sf]
    if (!mapping) {
      return
    }

    let reply: SecsSemanticEvent | undefined
    let replyIndex = -1
    const searchEnd = Math.min(events.length, index + TRANSACTION_REPLY_WINDOW + 1)

    for (let candidateIndex = index + 1; candidateIndex < searchEnd; candidateIndex += 1) {
      const candidate = events[candidateIndex]
      if (!candidate || usedReplyIndexes.has(candidateIndex) || candidate.sf !== mapping.replySf) {
        continue
      }

      reply = candidate
      replyIndex = candidateIndex
      break
    }

    const transactionId = `tx-${event.messageId}`
    const result = reply ? (reply.ack && !reply.ack.ok ? 'ng' : 'ok') : 'missing_reply'
    const latencyMs = resolveLatencyMs(event, reply)
    const timingSummary = getLatencySummary(event, reply)
    const summary = getReplySummary(event, reply)
    const transaction = {
      id: transactionId,
      summary,
      result,
      ackField: reply?.ack?.field,
      ackValue: reply?.ack?.value,
      latencyMs,
      timingSummary
    } as const

    event.transaction = transaction
    if (reply && replyIndex >= 0) {
      usedReplyIndexes.add(replyIndex)
      reply.transaction = transaction
    }
  })

  return events
}

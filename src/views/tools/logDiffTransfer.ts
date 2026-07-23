const LOG_DIFF_TRANSFER_STORAGE_PREFIX = 'secsTools_logDiffTransfer_'

export interface LogDiffTransferPayload {
  left: string
  right: string
}

function createTransferId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID()
  }

  return `${Date.now()}_${Math.random().toString(36).slice(2)}`
}

export function storeLogDiffTransferPayload(payload: LogDiffTransferPayload) {
  const transferId = createTransferId()
  localStorage.setItem(`${LOG_DIFF_TRANSFER_STORAGE_PREFIX}${transferId}`, JSON.stringify(payload))
  return transferId
}

export function consumeLogDiffTransferPayload(transferId: string) {
  const storageKey = `${LOG_DIFF_TRANSFER_STORAGE_PREFIX}${transferId}`
  const rawPayload = localStorage.getItem(storageKey)
  localStorage.removeItem(storageKey)

  if (!rawPayload) {
    return null
  }

  try {
    const payload = JSON.parse(rawPayload) as Partial<LogDiffTransferPayload>
    if (typeof payload.left !== 'string' || typeof payload.right !== 'string') {
      return null
    }

    return {
      left: payload.left,
      right: payload.right
    }
  } catch {
    return null
  }
}

export function discardLogDiffTransferPayload(transferId: string) {
  localStorage.removeItem(`${LOG_DIFF_TRANSFER_STORAGE_PREFIX}${transferId}`)
}

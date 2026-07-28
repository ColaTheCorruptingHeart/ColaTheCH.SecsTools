const SECS_SML_TRANSFER_STORAGE_PREFIX = 'secsTools_secsSmlTransfer_'

function createTransferId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID()
  }

  return `${Date.now()}_${Math.random().toString(36).slice(2)}`
}

export function storeSecsSmlTransferText(text: string) {
  const transferId = createTransferId()
  localStorage.setItem(`${SECS_SML_TRANSFER_STORAGE_PREFIX}${transferId}`, text)
  return transferId
}

export function consumeSecsSmlTransferText(transferId: string) {
  const storageKey = `${SECS_SML_TRANSFER_STORAGE_PREFIX}${transferId}`
  const text = localStorage.getItem(storageKey)
  localStorage.removeItem(storageKey)
  return text
}

export function discardSecsSmlTransferText(transferId: string) {
  localStorage.removeItem(`${SECS_SML_TRANSFER_STORAGE_PREFIX}${transferId}`)
}

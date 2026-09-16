type DateParts = {
  year: number
  month: number
  day: number
}

type DatePattern = {
  regex: RegExp
  toDateParts: (match: RegExpExecArray) => DateParts
}

export type RangeExportMachineSettings = {
  machineIds: string[]
}

export type RangeExportFileNameParams = {
  machineId: string
  batchId: string
  startLine: number
  endLine: number
  logDate: string
  contentHash: string
}

export type StructuredExportFileNameParams = {
  machineId: string
  batchId: string
  fallbackSegment: string
  logDate: string
  contentHash: string
  extension: string
}

const MACHINE_SETTINGS_STORAGE_KEY = 'colathech:secs-tools:log-timeline:range-export-machines'
const MAX_MACHINE_OPTION_COUNT = 20

const datePatterns: DatePattern[] = [
  {
    regex: /(?:^|\D)((?:19|20)\d{2})([-_. ])(\d{1,2})\2(\d{1,2})(?!\d)/g,
    toDateParts: match => ({ year: Number(match[1]), month: Number(match[3]), day: Number(match[4]) })
  },
  {
    regex: /(?:^|\D)((?:19|20)\d{2})\u5e74(\d{1,2})\u6708(\d{1,2})\u65e5?/g,
    toDateParts: match => ({ year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) })
  },
  {
    regex: /(?:^|\D)((?:19|20)\d{2})(\d{2})(\d{2})/g,
    toDateParts: match => ({ year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) })
  },
  {
    regex: /(?:^|\D)(\d{1,2})([-_. ])(\d{1,2})\2((?:19|20)\d{2})(?!\d)/g,
    toDateParts: match => ({ year: Number(match[4]), month: Number(match[3]), day: Number(match[1]) })
  }
]

const isValidDate = ({ year, month, day }: DateParts) => {
  if (month < 1 || month > 12 || day < 1) {
    return false
  }

  return day <= new Date(Date.UTC(year, month, 0)).getUTCDate()
}

const formatDateParts = ({ year, month, day }: DateParts) => {
  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
}

export const extractDateFromFileName = (fileName: string): string | null => {
  for (const { regex, toDateParts } of datePatterns) {
    regex.lastIndex = 0

    let match = regex.exec(fileName)
    while (match) {
      const dateParts = toDateParts(match)
      if (isValidDate(dateParts)) {
        return formatDateParts(dateParts)
      }

      match = regex.exec(fileName)
    }
  }

  return null
}

export const normalizeFileNameSegment = (value: string) => {
  return value
    .trim()
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[._-]+|[._-]+$/g, '')
}

export const buildStructuredExportFileName = ({
  machineId,
  batchId,
  fallbackSegment,
  logDate,
  contentHash,
  extension
}: StructuredExportFileNameParams) => {
  const segments: string[] = []
  const normalizedMachineId = normalizeFileNameSegment(machineId)

  if (normalizedMachineId) {
    segments.push(normalizedMachineId)
  }

  segments.push(normalizeFileNameSegment(batchId) || normalizeFileNameSegment(fallbackSegment) || 'export')
  segments.push(normalizeFileNameSegment(logDate) || 'unknown-date')
  segments.push(normalizeFileNameSegment(contentHash) || 'content-hash')

  const normalizedExtension = normalizeFileNameSegment(extension.replace(/^\.+/, '')) || 'log'
  return `${segments.join('_')}.${normalizedExtension}`
}

export const buildRangeExportFileName = ({
  machineId,
  batchId,
  startLine,
  endLine,
  logDate,
  contentHash
}: RangeExportFileNameParams) => {
  return buildStructuredExportFileName({
    machineId,
    batchId,
    fallbackSegment: `L${startLine}-L${endLine}`,
    logDate,
    contentHash,
    extension: 'log'
  })
}

const createFallbackContentHash = (bytes: Uint8Array) => {
  let hash = 0x811c9dc5
  for (const byte of bytes) {
    hash ^= byte
    hash = Math.imul(hash, 0x01000193)
  }

  return (hash >>> 0).toString(16).padStart(8, '0').toUpperCase()
}

export const createRangeExportContentHash = async (content: string, length = 12) => {
  const bytes = new TextEncoder().encode(content)
  if (!globalThis.crypto?.subtle) {
    return createFallbackContentHash(bytes)
  }

  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  const fullHash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase()
  return fullHash.slice(0, Math.max(1, length))
}

export const loadRangeExportMachineSettings = (): RangeExportMachineSettings => {
  try {
    const rawSettings = globalThis.localStorage?.getItem(MACHINE_SETTINGS_STORAGE_KEY)
    if (!rawSettings) {
      return { machineIds: [] }
    }

    const parsedSettings = JSON.parse(rawSettings) as Partial<RangeExportMachineSettings>
    const machineIds = Array.isArray(parsedSettings.machineIds)
      ? parsedSettings.machineIds.filter((value): value is string => typeof value === 'string' && Boolean(value.trim()))
      : []

    return {
      machineIds: Array.from(new Set(machineIds.map(value => value.trim()))).slice(0, MAX_MACHINE_OPTION_COUNT)
    }
  } catch (error) {
    console.error('Failed to load range export machine settings', error)
    return { machineIds: [] }
  }
}

const persistRangeExportMachineSettings = (machineIds: string[]) => {
  const settings: RangeExportMachineSettings = {
    machineIds: machineIds.slice(0, MAX_MACHINE_OPTION_COUNT)
  }

  try {
    globalThis.localStorage?.setItem(MACHINE_SETTINGS_STORAGE_KEY, JSON.stringify(settings))
  } catch (error) {
    console.error('Failed to save range export machine settings', error)
  }

  return settings
}

export const saveRangeExportMachineSettings = (machineId: string, currentMachineIds: string[]) => {
  const normalizedMachineId = machineId.trim()
  const machineIds = normalizedMachineId
    ? [normalizedMachineId, ...currentMachineIds.filter(value => value !== normalizedMachineId)]
    : [...currentMachineIds]

  return persistRangeExportMachineSettings(machineIds)
}

export const deleteRangeExportMachineOption = (machineId: string, currentMachineIds: string[]) => {
  return persistRangeExportMachineSettings(currentMachineIds.filter(value => value !== machineId))
}

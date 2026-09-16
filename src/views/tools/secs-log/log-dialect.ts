import type { SecsLogDialect, SecsLogDialectMatch, SecsLogMessageHeaderMatch } from './types'

const SF_PATTERN = 'S\\d+\\s*F\\s*\\d+'
const STANDALONE_SF_PATTERN = new RegExp(`^(${SF_PATTERN})(?:\\s+W)?[.;]?$`, 'i')
const LOG_DIRECTION_PATTERN = '(?:\\[\\s*)?(?:SEND|RECV|SENT|RECEIVED|TX|RX|H\\s*->\\s*E|E\\s*->\\s*H|HOST\\s*->\\s*EQUIPMENT|EQUIPMENT\\s*->\\s*HOST)(?:\\s*\\])?'
const DATE_PREFIX_PATTERN = '(?:\\d{4}(?:(?:[-/.]\\d{2}){2}|\\d{4})[ T]+)?'
const TIME_PATTERN = '(\\d{2}:\\d{2}:\\d{2}(?:[.,]\\d{1,6})?)'
const META_PATTERN = '(?:\\s+(?:\\[[^\\]]+\\]|\\([^)]*\\)|TRACE|DEBUG|INFO|WARN(?:ING)?|ERROR))*'
const SF_SEQUENCE_PATTERN = `((?:${SF_PATTERN})(?::${SF_PATTERN})*)`
const LEGACY_HEADER_PATTERN = new RegExp(`^${DATE_PREFIX_PATTERN}${TIME_PATTERN}${META_PATTERN}\\s+${LOG_DIRECTION_PATTERN}\\s+${SF_SEQUENCE_PATTERN}\\b`, 'i')
const LEGACY_TIME_PREFIX_PATTERN = new RegExp(`^${DATE_PREFIX_PATTERN}${TIME_PATTERN}`, 'i')
const BRACKET_HEADER_PATTERN = new RegExp(`^\\[${DATE_PREFIX_PATTERN}${TIME_PATTERN}\\]${META_PATTERN}\\s+${LOG_DIRECTION_PATTERN}\\s+${SF_SEQUENCE_PATTERN}\\b`, 'i')
const BRACKET_TIME_PREFIX_PATTERN = new RegExp(`^\\[${DATE_PREFIX_PATTERN}${TIME_PATTERN}\\]`, 'i')

export function normalizeSfName(rawValue: string) {
  const match = rawValue.match(/S(\d+)\s*F\s*(\d+)/i)
  return match ? `S${Number(match[1])}F${Number(match[2])}` : ''
}

function createHeaderMatcher(pattern: RegExp) {
  return (lineTrim: string): SecsLogMessageHeaderMatch | null => {
    const match = lineTrim.match(pattern)
    if (!match?.[1] || !match[2]) {
      return null
    }

    const sfName = normalizeSfName(match[2])
    if (!sfName) {
      return null
    }

    return {
      time: normalizeTime(match[1]),
      sfName
    }
  }
}

function createTimePrefixMatcher(pattern: RegExp) {
  return (lineTrim: string) => {
    const match = lineTrim.match(pattern)
    return match?.[1] ? normalizeTime(match[1]) : null
  }
}

function normalizeTime(rawTime: string) {
  const [clock, fraction = ''] = rawTime.replace(',', '.').split('.')
  return `${clock}.${fraction.padEnd(3, '0').slice(0, 3)}`
}

function matchStandaloneSfValue(lineTrim: string) {
  const match = lineTrim.match(STANDALONE_SF_PATTERN)
  return match?.[1] ? normalizeSfName(match[1]) : null
}

export const secsLogDialects: SecsLogDialect[] = [
  {
    id: 'bracket-timestamp',
    matchHeaderLine: createHeaderMatcher(BRACKET_HEADER_PATTERN),
    matchStandaloneSfLine: matchStandaloneSfValue,
    matchTimePrefixLine: createTimePrefixMatcher(BRACKET_TIME_PREFIX_PATTERN)
  },
  {
    id: 'legacy-inline',
    matchHeaderLine: createHeaderMatcher(LEGACY_HEADER_PATTERN),
    matchStandaloneSfLine: matchStandaloneSfValue,
    matchTimePrefixLine: createTimePrefixMatcher(LEGACY_TIME_PREFIX_PATTERN)
  }
]

function getOrderedDialects(preferredDialect: SecsLogDialect | null) {
  if (!preferredDialect) {
    return secsLogDialects
  }

  return [preferredDialect, ...secsLogDialects.filter(dialect => dialect !== preferredDialect)]
}

function matchWithDialects<T>(
  lineTrim: string,
  preferredDialect: SecsLogDialect | null,
  matcher: (dialect: SecsLogDialect, line: string) => T | null
): SecsLogDialectMatch<T> | null {
  for (const dialect of getOrderedDialects(preferredDialect)) {
    const value = matcher(dialect, lineTrim)
    if (value !== null) {
      return { dialect, value }
    }
  }

  return null
}

export function matchHeaderLine(lineTrim: string, preferredDialect: SecsLogDialect | null) {
  return matchWithDialects(lineTrim, preferredDialect, (dialect, line) => dialect.matchHeaderLine(line))
}

export function matchStandaloneSfLine(lineTrim: string, preferredDialect: SecsLogDialect | null) {
  return matchWithDialects(lineTrim, preferredDialect, (dialect, line) => dialect.matchStandaloneSfLine(line))
}

export function matchTimePrefixLine(lineTrim: string, preferredDialect: SecsLogDialect | null) {
  return matchWithDialects(lineTrim, preferredDialect, (dialect, line) => dialect.matchTimePrefixLine(line))
}

export function extractValueFromDataLine(lineTrim: string) {
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

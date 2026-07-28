import type { SecsLogDialect, SecsLogDialectMatch, SecsLogMessageHeaderMatch } from './types'

const STANDALONE_SF_PATTERN = /^(S\d+F\d+)(?:\s+W)?$/i
const LEGACY_HEADER_PATTERN = /^(\d{2}:\d{2}:\d{2}\.\d{3})\s+(?:SEND|RECV)\s+((?:S\d+F\d+)(?::S\d+F\d+)*)\b/i
const LEGACY_TIME_PREFIX_PATTERN = /^(?:\d{4}-\d{2}-\d{2}\s+)?(\d{2}:\d{2}:\d{2}\.\d{3})/
const BRACKET_HEADER_PATTERN = /^\[(?:\d{4}-\d{2}-\d{2}\s+)?(\d{2}:\d{2}:\d{2}\.\d{3})\]\s+(?:SEND|RECV)\s+((?:S\d+F\d+)(?::S\d+F\d+)*)\b/i
const BRACKET_TIME_PREFIX_PATTERN = /^\[(?:\d{4}-\d{2}-\d{2}\s+)?(\d{2}:\d{2}:\d{2}\.\d{3})\]/

export function normalizeSfName(rawValue: string) {
  const match = rawValue.match(/S\d+F\d+/i)
  return match?.[0]?.toUpperCase() || ''
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
      time: match[1],
      sfName
    }
  }
}

function createTimePrefixMatcher(pattern: RegExp) {
  return (lineTrim: string) => {
    const match = lineTrim.match(pattern)
    return match?.[1] || null
  }
}

function matchStandaloneSfValue(lineTrim: string) {
  const match = lineTrim.match(STANDALONE_SF_PATTERN)
  return match?.[1]?.toUpperCase() || null
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

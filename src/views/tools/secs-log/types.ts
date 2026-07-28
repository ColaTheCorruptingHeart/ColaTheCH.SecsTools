export interface LogMessageBlock {
  startLine: number
  contentStartLine: number
  endLine: number
}

export interface SecsLogMessageHeaderMatch {
  time: string
  sfName: string
}

export interface SecsLogDialect {
  id: string
  matchHeaderLine: (lineTrim: string) => SecsLogMessageHeaderMatch | null
  matchStandaloneSfLine: (lineTrim: string) => string | null
  matchTimePrefixLine: (lineTrim: string) => string | null
}

export interface SecsLogDialectMatch<T> {
  dialect: SecsLogDialect
  value: T
}

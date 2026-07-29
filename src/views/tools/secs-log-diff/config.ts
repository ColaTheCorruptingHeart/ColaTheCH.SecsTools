export const SECS_LOG_DIFF_LIMITS = {
  softTextBytes: 20 * 1024 * 1024,
  hardTextBytes: 50 * 1024 * 1024,
  softMessageCount: 10_000,
  hardMessageCount: 30_000,
  maxHighlightRows: 1_500,
  matchWindowSize: 30
} as const

export const DEFAULT_SECS_LOG_DIFF_OPTIONS = {
  matchWindowSize: SECS_LOG_DIFF_LIMITS.matchWindowSize,
  includeEqualRows: true
} as const

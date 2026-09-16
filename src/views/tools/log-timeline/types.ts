import type { LogMessageBlock } from '../secs-log/types'

export type { LogMessageBlock } from '../secs-log/types'
import type { SmlDiagnosticCode } from '../secs-log/sml'

export type CeidMatchMode = 'S6F11' | 'S6F3' | 'CUSTOM'

export interface CeidMatchRule {
  s: number
  f: number
  keyPos: string
}

export interface RuleItem {
  ceid: string
  desc: string
  color: string
  enabled?: boolean
}

export interface SxFyRuleItem {
  id: string
  s: number
  f: number
  color: string
  enabled?: boolean
  keyPos?: string
  desc?: string
}

export type RangeMarkerKind = 'start' | 'end'

export type TimelineItemType = 'CEID' | 'SxFy' | 'RangeMarker'

export interface TimelineItem {
  time: string
  sxFy: string
  ceid: string
  ruleId?: string
  desc: string
  line: number
  type?: TimelineItemType
  rangeMarkers?: RangeMarkerKind[]
}

export interface TimelineParseDiagnostic {
  blockStartLine: number
  line: number
  column: number
  sfName: string
  code: SmlDiagnosticCode
  severity: 'warning' | 'error'
  message: string
}

export interface LogTimelineAnalysisResult {
  timeline: TimelineItem[]
  diagnostics: TimelineParseDiagnostic[]
  messageCount: number
}

export interface ExportedMatchedBlock {
  uniqueKey: number
  block: LogMessageBlock
  items: TimelineItem[]
  sxFy: string
  desc: string
  ceid: string
  text: string
}

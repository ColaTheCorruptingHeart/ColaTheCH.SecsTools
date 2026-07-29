export type SecsLogDiffSide = 'baseline' | 'target'
export type SecsLogDiffKind =
  | 'equal'
  | 'added'
  | 'missing'
  | 'changed'
  | 'field_changed'
  | 'ack_error'
  | 'parse_error'
export type SecsLogDiffSeverity = 'critical' | 'major' | 'minor' | 'info'
export type SecsLogEventType =
  | 'remote_command'
  | 'remote_command_ack'
  | 'event_report'
  | 'event_ack'
  | 'alarm_report'
  | 'alarm_ack'
  | 'generic'
  | 'parse_error'
export type MessageDiffMode = 'ignore' | 'presence' | 'key-only' | 'field' | 'raw'
export type DiffPathValueMode = 'value' | 'subtree'

export interface DiffPathRule {
  id: string
  label: string
  path: string
  valueMode?: DiffPathValueMode
  compare?: boolean
  required?: boolean
}

export interface AckRule {
  field: 'HCACK' | 'ACKC6' | 'ACKC5'
  path: string
  successValues: string[]
  severity?: SecsLogDiffSeverity
}

export interface MessageDiffRule {
  id: string
  enabled: boolean
  sf: string
  mode: MessageDiffMode
  keyPaths: DiffPathRule[]
  fieldPaths: DiffPathRule[]
  ignorePaths?: string[]
  ackRule?: AckRule
  desc?: string
  severity?: Partial<Record<SecsLogDiffKind, SecsLogDiffSeverity>>
  extractor?: 'S2F41' | 'S2F42' | 'S6F11' | 'S6F12' | 'S5F1' | 'S5F2'
}

export interface SecsLogDiffProfile {
  id: string
  name: string
  rules: MessageDiffRule[]
}

export interface SecsLogDiffOptions {
  matchWindowSize: number
  includeEqualRows: boolean
  profile: SecsLogDiffProfile
}

export interface SecsLogMessage {
  id: string
  side: SecsLogDiffSide
  index: number
  startLine: number
  contentStartLine: number
  endLine: number
  time: string
  timeMs?: number
  sf: string
  rawText: string
  parseError?: string
}

export interface SecsSemanticEvent {
  id: string
  messageId: string
  index: number
  sf: string
  time: string
  timeMs?: number
  type: SecsLogEventType
  key: string
  summary: string
  attributes: Record<string, string>
  rawText: string
  parseError?: string
  ruleId?: string
  ruleSeverity?: Partial<Record<SecsLogDiffKind, SecsLogDiffSeverity>>
  diffMode: MessageDiffMode
  ack?: {
    field: 'HCACK' | 'ACKC6' | 'ACKC5'
    value: string
    ok: boolean
    meaning: string
  }
}

export interface SecsFieldDiff {
  field: string
  baselineValue: string
  targetValue: string
}

export interface SecsDiffItem {
  id: string
  kind: SecsLogDiffKind
  severity: SecsLogDiffSeverity
  baselineEvent?: SecsSemanticEvent
  targetEvent?: SecsSemanticEvent
  title: string
  detail: string
  fieldDiffs: SecsFieldDiff[]
  semanticSummary?: string
  ackSummary?: string
}

export interface SecsDiffRenderRow {
  id: string
  kind: SecsLogDiffKind
  severity: SecsLogDiffSeverity
  baselineMessageId?: string
  targetMessageId?: string
  baselineText: string
  targetText: string
  baselineOriginalLine?: number
  targetOriginalLine?: number
  baselineDisplayStartLine: number
  baselineDisplayEndLine: number
  targetDisplayStartLine: number
  targetDisplayEndLine: number
  title: string
  detail: string
  baselineKey?: string
  targetKey?: string
  fieldDiffs: SecsFieldDiff[]
  semanticSummary?: string
  ackSummary?: string
}

export interface SecsLogDiffStats {
  baselineLines: number
  targetLines: number
  baselineMessages: number
  targetMessages: number
  totalRows: number
  diffRows: number
  added: number
  missing: number
  changed: number
  fieldChanged: number
  ackError: number
  parseError: number
}

export interface SecsLogDiffResult {
  baselineText: string
  targetText: string
  rows: SecsDiffRenderRow[]
  messages: {
    baseline: SecsLogMessage[]
    target: SecsLogMessage[]
  }
  stats: SecsLogDiffStats
  warnings: string[]
}

export type SecsLogDiffWorkerRequest = {
  type: 'analyze'
  baselineText: string
  targetText: string
  options: SecsLogDiffOptions
}

export type SecsLogDiffWorkerResponse =
  | {
      type: 'success'
      result: SecsLogDiffResult
    }
  | {
      type: 'error'
      error: string
    }

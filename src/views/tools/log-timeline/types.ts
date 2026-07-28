import type { LogMessageBlock } from '../secs-log/types'

export type { LogMessageBlock } from '../secs-log/types'

export type CeidMatchMode = 'S6F11' | 'S6F3'

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

export interface TimelineItem {
  time: string
  sxFy: string
  ceid: string
  ruleId?: string
  desc: string
  line: number
  type?: 'CEID' | 'SxFy'
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

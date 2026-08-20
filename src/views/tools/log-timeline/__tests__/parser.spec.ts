import { describe, expect, it } from 'vitest'
import { analyzeLogTimeline } from '../parser'
import type { RuleItem, SxFyRuleItem } from '../types'
import {
  MULTI_DIALECT_LOG,
  STANDALONE_S2F41
} from '../../secs-log/__tests__/fixtures'

const ceidRules: RuleItem[] = [
  { ceid: '5', desc: 'Process state changed', color: '#f00' }
]

const sxfyRules: SxFyRuleItem[] = [
  { id: 's2f41-command', s: 2, f: 41, keyPos: '[0][0]', desc: 'RCMD', color: '#0f0' },
  { id: 's6f11-presence', s: 6, f: 11, desc: 'Event report', color: '#00f' }
]

describe('SECS log timeline analysis', () => {
  it('extracts CEID and configured paths across mixed log dialects', () => {
    const result = analyzeLogTimeline(MULTI_DIALECT_LOG, ceidRules, sxfyRules)

    expect(result.filter(item => item.type === 'CEID')).toHaveLength(2)
    expect(result).toContainEqual(expect.objectContaining({
      time: '01:14:32.796', sxFy: 'S6F11', ceid: '5', desc: 'Process state changed'
    }))
    expect(result).toContainEqual(expect.objectContaining({
      time: '01:14:33.123', sxFy: 'S2F41', desc: 'RCMD: START', ruleId: 's2f41-command'
    }))
  })

  it('keeps standalone SML events with an empty time', () => {
    const result = analyzeLogTimeline(STANDALONE_S2F41, [], sxfyRules)

    expect(result).toEqual([
      expect.objectContaining({ time: '', sxFy: 'S2F41', desc: 'RCMD: START' })
    ])
  })

  it('ignores disabled rules', () => {
    const result = analyzeLogTimeline(STANDALONE_S2F41, [], [
      { ...sxfyRules[0]!, enabled: false }
    ])

    expect(result).toEqual([])
  })
})

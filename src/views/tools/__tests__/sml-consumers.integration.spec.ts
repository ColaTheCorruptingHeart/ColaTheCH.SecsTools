import { describe, expect, it } from 'vitest'
import { analyzeLogTimelineDetailed } from '../log-timeline/parser'
import type { SxFyRuleItem } from '../log-timeline/types'
import { extractS1F12Svid } from '../s1f12-svid'
import { analyzeSecsLogDiff } from '../secs-log-diff/analyzer'
import { SECS_LOG_DIFF_LIMITS } from '../secs-log-diff/config'
import { cloneDefaultProfile } from '../secs-log-diff/rules'
import { formatSecsSml } from '../secsSml'

const vendorCommand = `20260806 01:00:00,125 [worker-7] TX S02 F 041 W
<LIST [2] {MESSAGE}
  <ASCII {RCMD} "START">
  <LIST [1] {PARAMETERS}
    <LIST [2]
      <ASCII "LOTID">
      <ASCII "LOT-009">
    >
  >
>;`

const vendorS1F12 = `S01F012
<LIST [1] {SV_LIST}
  <LIST [3]
    <UINT32 1001>
    <ASCII "Temperature">
    <ASCII "C">
  >
>;`

const commandRules: SxFyRuleItem[] = [
  { id: 'command', s: 2, f: 41, keyPos: '[0][0]', desc: 'RCMD', color: '#f97316' }
]

describe('shared SML consumer integration', () => {
  it('feeds the same vendor dialect through formatter, timeline and semantic diff', () => {
    const formatted = formatSecsSml(vendorCommand)
    const timeline = analyzeLogTimelineDetailed(vendorCommand, [], commandRules)
    const changed = vendorCommand.replace('LOT-009', 'LOT-010')
    const diff = analyzeSecsLogDiff(vendorCommand, changed, {
      matchWindowSize: SECS_LOG_DIFF_LIMITS.matchWindowSize,
      includeEqualRows: true,
      profile: cloneDefaultProfile()
    })

    expect(formatted.diagnostics).toEqual([])
    expect(formatted.text).toMatch(/^S2F41 W\n/)
    expect(formatted.text).toContain('<ASCII "START">')
    expect(formatted.text).toContain('>;')
    expect(timeline.diagnostics).toEqual([])
    expect(timeline.timeline).toContainEqual(expect.objectContaining({
      time: '01:00:00.125', sxFy: 'S2F41', desc: 'RCMD: START'
    }))
    expect(diff.stats.changed + diff.stats.fieldChanged).toBeGreaterThan(0)
    expect(diff.stats.parseError).toBe(0)
  })

  it('feeds bracket-count and long-name types through S1F12 extraction', () => {
    const result = extractS1F12Svid(vendorS1F12)

    expect(result.diagnostics).toEqual([])
    expect(result.rows).toEqual([
      { index: 1, svid: '1001', svname: 'Temperature', units: 'C', remark: '' }
    ])
  })
})

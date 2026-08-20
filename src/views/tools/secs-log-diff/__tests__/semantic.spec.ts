import { describe, expect, it } from 'vitest'
import { buildSecsLogMessages } from '../parser'
import { cloneDefaultProfile } from '../rules'
import { buildSemanticEvents } from '../semantic'
import {
  S6F11_CHANGED,
  STANDARD_S6F11,
  STANDALONE_S2F41
} from '../../secs-log/__tests__/fixtures'

function buildEvents(text: string) {
  return buildSemanticEvents(buildSecsLogMessages(text, 'baseline'), cloneDefaultProfile())
}

describe('SECS semantic extraction', () => {
  it('extracts CEID and body fields from S6F11', () => {
    const event = buildEvents(STANDARD_S6F11)[0]

    expect(event).toMatchObject({
      sf: 'S6F11',
      time: '01:14:32.796',
      key: 'S6F11:CEID=5',
      summary: 'S6F11 CEID=5'
    })
    expect(event?.attributes.CEID).toBe('5')
    expect(event?.attributes.Body).toContain('<A "READY">')
  })

  it('extracts a remote command from standalone pure SML', () => {
    const event = buildEvents(STANDALONE_S2F41)[0]

    expect(event).toMatchObject({
      sf: 'S2F41',
      time: '',
      key: 'S2F41:RCMD=START',
      summary: 'S2F41 START'
    })
    expect(event?.attributes).toMatchObject({ RCMD: 'START', 'CP.LOTID': 'LOT-001' })
  })

  it('produces different semantic body values for changed reports', () => {
    const baseline = buildEvents(STANDARD_S6F11)[0]
    const target = buildEvents(S6F11_CHANGED)[0]

    expect(target?.key).toBe(baseline?.key)
    expect(target?.attributes.Body).not.toBe(baseline?.attributes.Body)
    expect(target?.attributes.Body).toContain('<A "RUNNING">')
  })

  it('turns fatal SML diagnostics into semantic parse errors', () => {
    const event = buildEvents(`01:00:00 SEND S2F41\nS2F41 W\n<L,1\n  <A 'START'>`)[0]

    expect(event).toMatchObject({ sf: 'S2F41', type: 'parse_error' })
    expect(event?.parseError).toContain('列表未闭合')
  })

  it('keeps recoverable diagnostics while extracting semantic values', () => {
    const event = buildEvents(`01:00:00 SEND S2F41\nS2F41 W\n<L,3\n  <A 'START'>\n  <L,0\n  >\n>.`)[0]

    expect(event).toMatchObject({ sf: 'S2F41', type: 'remote_command' })
    expect(event?.parseWarnings?.[0]).toContain('列表声明 3 项')
  })
})

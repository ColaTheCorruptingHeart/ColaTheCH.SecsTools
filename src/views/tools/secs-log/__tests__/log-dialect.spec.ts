import { describe, expect, it } from 'vitest'
import {
  matchHeaderLine,
  matchStandaloneSfLine,
  matchTimePrefixLine
} from '../log-dialect'

describe('SECS log dialects', () => {
  it.each([
    ['01:14:32.796 SEND S6F11 W', 'legacy-inline', '01:14:32.796'],
    ['2026/08/06 01:14:32 SENT S2F41', 'legacy-inline', '01:14:32.000'],
    ['[2026-08-06T01:14:32.7] RECEIVED S1F12', 'bracket-timestamp', '01:14:32.700'],
    ['[2026/08/06 01:14:32.123456] H->E S6F11', 'bracket-timestamp', '01:14:32.123']
  ])('recognizes %s', (line, dialectId, time) => {
    const match = matchHeaderLine(line, null)

    expect(match?.dialect.id).toBe(dialectId)
    expect(match?.value).toMatchObject({ time })
  })

  it('recognizes standalone SxFy with optional W', () => {
    expect(matchStandaloneSfLine('s6f11 w', null)?.value).toBe('S6F11')
    expect(matchStandaloneSfLine('S6F11 extra', null)).toBeNull()
  })

  it('recognizes a timestamp-only prefix for split headers', () => {
    expect(matchTimePrefixLine('[2026-08-06 01:14:32.12] trace', null)?.value).toBe('01:14:32.120')
  })

  it('rejects unsupported prefixes and missing directions', () => {
    expect(matchHeaderLine('INFO 01:14:32.796 SEND S6F11', null)).toBeNull()
    expect(matchHeaderLine('01:14:32.796 S6F11', null)).toBeNull()
  })
})

import { describe, expect, it } from 'vitest'
import { extractS1F12Svid } from '../s1f12-svid'
import { STANDARD_S1F12, STANDARD_S6F11 } from '../secs-log/__tests__/fixtures'

describe('S1F12 SVID extraction', () => {
  it('extracts SVID, SVNAME and UNITS while normalizing quotes', () => {
    const result = extractS1F12Svid(STANDARD_S1F12)

    expect(result.rows).toEqual([
      { index: 1, svid: '1001', svname: 'Temperature', units: 'C', remark: '' },
      { index: 2, svid: '1002', svname: 'Pressure', units: '', remark: '' }
    ])
    expect(result.warnings).toContain('第 2 条 SVID 记录字段不足，已按可用字段提取')
    expect(result.diagnostics).toEqual([])
  })

  it('warns for a non-S1F12 header but still extracts compatible structures', () => {
    const result = extractS1F12Svid(STANDARD_S6F11)

    expect(result.warnings).toContain('报文头为 S6F11，不是 S1F12；仍按 S1F12 结构尝试提取')
  })

  it('returns an actionable warning when no SML root exists', () => {
    const result = extractS1F12Svid('S1F12')

    expect(result.rows).toEqual([])
    expect(result.warnings).toContain('未找到 S1F12 的根列表')
  })

  it('retains structured parser diagnostics for source navigation', () => {
    const result = extractS1F12Svid(`S1F12\n<L,1\n  <L,2\n    <U4 1>\n  >\n>.`)

    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code: 'declared-count-mismatch', line: 3, severity: 'warning'
    }))
    expect(result.warnings[0]).toContain('第 3 行，第 3 列')
  })
})

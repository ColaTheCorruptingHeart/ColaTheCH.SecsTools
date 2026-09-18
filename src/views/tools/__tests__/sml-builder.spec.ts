import { describe, expect, it } from 'vitest'
import {
  cloneNode,
  createParameterPair,
  createS2F41Draft,
  formatSmlDraftForCopy,
  getNodePath,
  serializeSmlDraft,
  validateSmlDraft
} from '../smlBuilder'

describe('SML builder', () => {
  it('serializes the S2F41 template with calculated list counts', () => {
    const draft = createS2F41Draft()
    const parameters = draft.root.children[1]!
    parameters.children.push(createParameterPair('LOTID', 'A', 'LOT-001'))

    const output = serializeSmlDraft(draft)

    expect(output).toContain('S2F41 W')
    expect(output).toContain('<L [4]')
    expect(output).toContain('    <L [2]')
    expect(output).toContain('<A "LOTID">')
    expect(output.endsWith('>.')).toBe(true)
  })

  it('applies configurable quote styles by data category', () => {
    const draft = createS2F41Draft()
    const output = serializeSmlDraft(draft, {
      numericQuote: 'single',
      textQuote: 'single'
    })

    expect(output).toContain("<A 'START'>")
    expect(output).toContain("<U1 '1'>")
    expect(output).toContain('<BOOLEAN TRUE>')
  })

  it('pads character values to an optional declared length and reports overflow', () => {
    const draft = createS2F41Draft()
    const rcmd = draft.root.children[0]!
    rcmd.declaredLength = 8

    expect(serializeSmlDraft(draft)).toContain('<A [8] "START   ">')
    expect(validateSmlDraft(draft, 's2f41').some(issue => issue.nodeId === rcmd.id)).toBe(false)

    rcmd.declaredLength = 4
    expect(validateSmlDraft(draft, 's2f41')).toContainEqual(expect.objectContaining({
      nodeId: rcmd.id,
      severity: 'error',
      message: 'RCMD 当前 5 个字符，超过声明长度 4'
    }))
  })

  it('uses the shared SML formatter for clipboard output', () => {
    const formatted = formatSmlDraftForCopy(createS2F41Draft(), {
      numericQuote: 'double',
      textQuote: 'single'
    })

    expect(formatted.diagnostics).toEqual([])
    expect(formatted.text).toContain("    <A 'START'>")
    expect(formatted.text).toContain('            <U1 "1">')
    expect(formatted.text).not.toContain('<L [')
  })

  it('validates typed parameter values and duplicate names', () => {
    const draft = createS2F41Draft()
    const parameters = draft.root.children[1]!
    parameters.children.push(createParameterPair('PORT', 'U1', '300'))

    const issues = validateSmlDraft(draft, 's2f41')

    expect(issues.some(issue => issue.message.includes('超出 U1 范围'))).toBe(true)
    expect(issues.some(issue => issue.message.includes('CPNAME “PORT”重复'))).toBe(true)
  })

  it('clones branches with independent ids and resolves paths', () => {
    const draft = createS2F41Draft()
    const original = draft.root.children[1]!.children[0]!
    const copy = cloneNode(original)
    draft.root.children[1]!.children.push(copy)

    expect(copy.id).not.toBe(original.id)
    expect(copy.children[0]!.id).not.toBe(original.children[0]!.id)
    expect(copy.declaredLength).toBe(original.declaredLength)
    expect(getNodePath(draft.root, copy.children[1]!.id)).toBe('[0][1][3][1]')
  })
})

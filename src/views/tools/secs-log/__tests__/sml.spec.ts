import { describe, expect, it } from 'vitest'
import {
  formatSecsSml,
  getNodeAtPath,
  getNodeValueText,
  parseSmlTree
} from '../sml'
import { COMPACT_S1F12, STANDARD_S6F11 } from './fixtures'

describe('SECS SML parser', () => {
  it('parses multiline lists, metadata, values and source ranges', () => {
    const parsed = parseSmlTree(STANDARD_S6F11)
    const root = parsed.roots[0]
    const ceid = getNodeAtPath(parsed.roots, [0, 1])
    const values = getNodeAtPath(parsed.roots, [0, 2, 0, 1, 1])

    expect(parsed.header).toBe('S6F11 W')
    expect(parsed.hasTerminalDot).toBe(true)
    expect(parsed.diagnostics).toEqual([])
    expect(root).toMatchObject({ kind: 'list', typeName: 'L', declaredCount: 3 })
    expect(root?.children).toHaveLength(3)
    expect(ceid).toMatchObject({ typeName: 'U2', declaredCount: 1, label: 'CEID' })
    expect(getNodeValueText(ceid)).toBe("'5'")
    expect(values?.values).toEqual(['1', '2', '3'])
    expect(ceid?.sourceRange?.startLine).toBe(4)
  })

  it('parses compact nested SML and keeps greater-than signs inside quotes', () => {
    const parsed = parseSmlTree(COMPACT_S1F12)
    const name = getNodeAtPath(parsed.roots, [0, 0, 1])

    expect(parsed.diagnostics).toEqual([])
    expect(parsed.roots[0]?.children[0]?.children).toHaveLength(3)
    expect(getNodeValueText(name)).toBe('"Temperature > limit"')
  })

  it('parses an explicitly closed empty list', () => {
    const parsed = parseSmlTree(`S1F14\n<L,0\n>.`)

    expect(parsed.roots[0]).toMatchObject({ kind: 'list', declaredCount: 0, children: [] })
    expect(parsed.diagnostics).toEqual([])
  })

  it('reports declared list count mismatches without dropping the tree', () => {
    const parsed = parseSmlTree(`<L,2\n<A 'only-one'>\n>.`)

    expect(parsed.roots[0]?.children).toHaveLength(1)
    expect(parsed.diagnostics).toEqual([
      expect.objectContaining({
        code: 'declared-count-mismatch',
        severity: 'warning',
        line: 1,
        column: 1,
        message: '列表声明 2 项，实际解析到 1 项'
      })
    ])
  })

  it('reports an unclosed list and retains parsed children', () => {
    const parsed = parseSmlTree(`<L,1\n<A 'value'>`)

    expect(parsed.roots[0]?.children).toHaveLength(1)
    expect(parsed.diagnostics).toContainEqual(
      expect.objectContaining({ severity: 'error', line: 1, message: '列表未闭合' })
    )
  })

  it('skips non-SML angle-bracket content before a valid SML node', () => {
    const parsed = parseSmlTree(`trace: value < threshold\n<div>not SML</div>\nS6F11\n<L,0\n>.`)

    expect(parsed.header).toBe('S6F11')
    expect(parsed.roots).toHaveLength(1)
    expect(parsed.roots[0]?.typeName).toBe('L')
    expect(parsed.diagnostics).toEqual([])
  })

  it('reports when non-empty input contains no recognized SML node', () => {
    const lenient = parseSmlTree('<message>plain XML</message>')
    const strict = parseSmlTree('<message>plain XML</message>', { mode: 'strict' })

    expect(lenient.roots).toEqual([])
    expect(lenient.diagnostics).toEqual([
      expect.objectContaining({ code: 'no-sml-node', severity: 'warning', line: 1, column: 1 })
    ])
    expect(strict.diagnostics?.[0]?.severity).toBe('error')
  })

  it('keeps unknown child types and lets strict mode promote the diagnostic', () => {
    const source = `<L,1\n<X2 7>\n>.`
    const lenient = parseSmlTree(source)
    const strict = parseSmlTree(source, { mode: 'strict' })
    const extended = parseSmlTree(source, { mode: 'strict', additionalTypes: ['X2'] })

    expect(lenient.roots[0]?.children[0]?.typeName).toBe('X2')
    expect(lenient.diagnostics).toContainEqual(
      expect.objectContaining({ code: 'unknown-data-type', severity: 'warning', line: 2 })
    )
    expect(strict.diagnostics).toContainEqual(
      expect.objectContaining({ code: 'unknown-data-type', severity: 'error' })
    )
    expect(extended.diagnostics).toEqual([])
  })

  it('recovers after unexpected list text and reports extra closing markers', () => {
    const parsed = parseSmlTree(`<L,1\n  ignored text\n  <A 'value'>\n>.\n>`)

    expect(parsed.roots[0]?.children).toHaveLength(1)
    expect(parsed.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'unexpected-text', severity: 'warning', line: 2 }),
      expect.objectContaining({ code: 'unexpected-close', severity: 'warning', line: 5 })
    ]))
  })

  it('formats a parsed tree and preserves clickable paths', () => {
    const result = formatSecsSml(STANDARD_S6F11)
    const ceidLine = result.lines.find(line => line.path === '[0][1]' && !line.text.trim().startsWith('>'))

    expect(result.text).toContain("    <U2 '5'>")
    expect(result.text.endsWith('>.')).toBe(true)
    expect(ceidLine).toMatchObject({ clickable: true, path: '[0][1]' })
  })
})

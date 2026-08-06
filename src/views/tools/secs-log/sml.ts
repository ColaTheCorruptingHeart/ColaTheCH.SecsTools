export interface SmlSourceRange {
  start: number
  end: number
  startLine: number
  endLine: number
}

export interface SmlDiagnostic {
  severity: 'warning' | 'error'
  message: string
  start: number
  end: number
  line: number
}

export interface SecsSmlNode {
  /** Kept for compatibility with the existing path and renderer helpers. */
  text: string
  children: SecsSmlNode[]
  kind?: 'list' | 'value'
  typeName?: string
  declaredCount?: number
  label?: string
  values?: string[]
  sourceRange?: SmlSourceRange
}

export interface ParsedSecsSmlTree {
  header: string
  roots: SecsSmlNode[]
  hasTerminalDot: boolean
  diagnostics?: SmlDiagnostic[]
}

export interface FormattedSecsSmlLine {
  text: string
  clickable: boolean
  path: string
  jumpToIndex?: number
}

export interface FormattedSecsSmlResult {
  lines: FormattedSecsSmlLine[]
  text: string
  diagnostics?: SmlDiagnostic[]
}

export function extractHeader(input: string) {
  const sfMatch = input.match(/\bS\d+F\d+\b/i)
  const headerLine = sfMatch ? input.slice(sfMatch.index || 0).split(/\r?\n/, 1)[0] || '' : ''
  const wMatch = headerLine.match(/(?:^|\s)W(?:\s|$)/i)
  const sf = sfMatch ? sfMatch[0].toUpperCase() : ''
  const w = wMatch ? ' W' : ''
  return `${sf}${w}`.trim()
}

function buildLineStarts(input: string) {
  const starts = [0]
  for (let i = 0; i < input.length; i += 1) if (input[i] === '\n') starts.push(i + 1)
  return starts
}

function lineNumberAt(lineStarts: number[], index: number) {
  let low = 0
  let high = lineStarts.length
  while (low < high) {
    const middle = Math.floor((low + high) / 2)
    if ((lineStarts[middle] || 0) <= index) low = middle + 1
    else high = middle
  }
  return low
}

function normalizeBody(body: string, keepLength = false) {
  const cleaned = body.replace(/\s+/g, ' ').trim()
  const match = cleaned.match(/^([A-Za-z][A-Za-z0-9]*)(?:,(\d+))?(?:\s*\[([^\]]*)\])*\s*(.*)$/)
  if (!match) return { typeName: cleaned, value: '', declaredCount: undefined, label: undefined }
  return {
    typeName: match[1] || cleaned,
    value: match[4]?.trim() || '',
    declaredCount: match[2] ? Number(match[2]) : undefined,
    label: match[3]?.trim() || undefined,
    raw: keepLength ? cleaned : undefined
  }
}

function splitScalarValues(value: string) {
  const values: string[] = []
  let current = ''
  let quote = ''
  for (let i = 0; i < value.length; i += 1) {
    const char = value[i] || ''
    if (quote) {
      current += char
      if (char === '\\' && i + 1 < value.length) current += value[++i]
      else if (char === quote) quote = ''
      continue
    }
    if (char === "'" || char === '"') {
      quote = char
      current += char
    } else if (/\s/.test(char)) {
      if (current) values.push(current)
      current = ''
    } else current += char
  }
  if (current) values.push(current)
  return values
}

export function normalizeOpenLine(line: string) {
  const trimmed = line.trim()
  const hasClose = trimmed.endsWith('>')
  const inner = trimmed.slice(1, hasClose ? -1 : undefined).trim()
  const parsed = normalizeBody(inner)
  const type = parsed.typeName || inner
  return `<${type}${parsed.value ? ` ${parsed.value}` : ''}${hasClose ? '>' : ''}`
}

function scanTagBoundary(input: string, start: number) {
  let quote = ''
  let newlineIndex = -1
  for (let i = start + 1; i < input.length; i += 1) {
    const char = input[i] || ''
    if (quote) {
      if (char === '\\') i += 1
      else if (char === quote) quote = ''
      continue
    }
    if (char === "'" || char === '"') {
      quote = char
      continue
    }
    if (char === '\n' && newlineIndex === -1) newlineIndex = i
    if (char === '<') return { tagEnd: -1, childStart: i, newlineIndex }
    if (char === '>') return { tagEnd: i, childStart: -1, newlineIndex }
  }
  return { tagEnd: -1, childStart: -1, newlineIndex }
}

function buildNode(input: string, start: number, diagnostics: SmlDiagnostic[], lineStarts: number[]): { node: SecsSmlNode; next: number } {
  const boundary = scanTagBoundary(input, start)
  let openingTagEnd = boundary.tagEnd
  let childStart = boundary.childStart
  const listWithoutInlineChildren = boundary.newlineIndex !== -1 && boundary.childStart === -1 && boundary.tagEnd !== -1
  if (listWithoutInlineChildren && /^L(?:,\d+)?/i.test(input.slice(start + 1, boundary.newlineIndex))) {
    openingTagEnd = -1
    childStart = boundary.newlineIndex + 1
  }
  const bodyEnd = openingTagEnd !== -1 ? openingTagEnd : (childStart === -1 ? input.length : childStart)
  const parsed = normalizeBody(input.slice(start + 1, bodyEnd), true)
  const typeName = parsed.typeName || input.slice(start + 1, bodyEnd).trim()
  if (childStart === -1 && openingTagEnd !== -1 && /^L$/i.test(typeName)) {
    let next = openingTagEnd + 1
    while (/\s/.test(input[next] || '')) next += 1
    if (input[next] === '<') childStart = next
  }
  const tagEnd = openingTagEnd
  const isList = childStart !== -1 || /^L$/i.test(typeName)
  const node: SecsSmlNode = {
    text: `<${typeName}${parsed.value ? ` ${parsed.value}` : ''}${childStart === -1 && tagEnd !== -1 ? '>' : ''}`,
    children: [],
    kind: isList ? 'list' : 'value',
    typeName,
    declaredCount: parsed.declaredCount,
    label: parsed.label,
    values: parsed.value ? splitScalarValues(parsed.value) : [],
    sourceRange: {
      start,
      end: tagEnd === -1 ? input.length : tagEnd + 1,
      startLine: lineNumberAt(lineStarts, start),
      endLine: lineNumberAt(lineStarts, tagEnd === -1 ? input.length : tagEnd)
    }
  }

  if (tagEnd === -1 && childStart === -1) {
    diagnostics.push({ severity: 'error', message: '未找到节点结束符 >', start, end: input.length, line: lineNumberAt(lineStarts, start) })
    return { node, next: input.length }
  }

  if (childStart === -1) return { node, next: tagEnd + 1 }

  let cursor = childStart
  while (cursor < input.length) {
    while (/\s/.test(input[cursor] || '')) cursor += 1
    if (input[cursor] === '>') {
      node.sourceRange = { ...node.sourceRange!, end: cursor + 1, endLine: lineNumberAt(lineStarts, cursor) }
      if (node.declaredCount !== undefined && node.declaredCount !== node.children.length) {
        diagnostics.push({ severity: 'warning', message: `列表声明 ${node.declaredCount} 项，实际解析到 ${node.children.length} 项`, start, end: cursor + 1, line: lineNumberAt(lineStarts, start) })
      }
      return { node, next: cursor + 1 }
    }
    if (input[cursor] !== '<') {
      const nextTag = input.indexOf('<', cursor)
      const end = nextTag === -1 ? input.length : nextTag
      if (input.slice(cursor, end).trim()) diagnostics.push({ severity: 'warning', message: '列表中存在未识别文本', start: cursor, end, line: lineNumberAt(lineStarts, cursor) })
      cursor = end
      continue
    }
    const child = buildNode(input, cursor, diagnostics, lineStarts)
    node.children.push(child.node)
    cursor = child.next
  }
  diagnostics.push({ severity: 'error', message: '列表未闭合', start, end: input.length, line: lineNumberAt(lineStarts, start) })
  return { node, next: input.length }
}

export function parseSmlTree(rawText: string): ParsedSecsSmlTree {
  if (!rawText || !rawText.trim()) return { header: '', roots: [], hasTerminalDot: false, diagnostics: [] }
  const diagnostics: SmlDiagnostic[] = []
  const lineStarts = buildLineStarts(rawText)
  const roots: SecsSmlNode[] = []
  let cursor = 0
  const firstStruct = rawText.search(/</)
  if (firstStruct < 0) return { header: extractHeader(rawText) || rawText.trim(), roots, hasTerminalDot: false, diagnostics }
  cursor = firstStruct
  while (cursor < rawText.length) {
    const next = rawText.indexOf('<', cursor)
    if (next < 0) break
    const parsed = buildNode(rawText, next, diagnostics, lineStarts)
    roots.push(parsed.node)
    cursor = parsed.next
  }
  const hasTerminalDot = />(?:\s*)\./.test(rawText)
  return { header: extractHeader(rawText), roots, hasTerminalDot, diagnostics }
}

export function pathToString(path: number[]) { return path.map(value => `[${value}]`).join('') }

export function buildFormattedResult(parsed: ParsedSecsSmlTree) {
  const lines: FormattedSecsSmlLine[] = []
  if (parsed.header) lines.push({ text: parsed.header, clickable: false, path: '' })
  function walk(node: SecsSmlNode, depth: number, path: number[]) {
    const text = `${'    '.repeat(depth)}${node.text}`
    const openLineIndex = lines.length
    lines.push({ text, clickable: true, path: pathToString(path), jumpToIndex: openLineIndex })
    if (node.children.length || !node.text.endsWith('>')) {
      node.children.forEach((child, index) => walk(child, depth + 1, path.concat(index)))
      lines.push({ text: `${'    '.repeat(depth)}>` + (depth === 0 && parsed.hasTerminalDot ? '.' : ''), clickable: true, path: pathToString(path), jumpToIndex: openLineIndex })
    }
  }
  parsed.roots.forEach((root, index) => walk(root, 0, [index]))
  return lines
}

export function formatSecsSml(rawText: string): FormattedSecsSmlResult {
  const parsed = parseSmlTree(rawText)
  const lines = buildFormattedResult(parsed)
  return { lines, text: lines.map(line => line.text).join('\n'), diagnostics: parsed.diagnostics }
}

export function getNodeValueText(node: SecsSmlNode | undefined) {
  if (!node) return ''
  if (node.values?.length) return node.values.join(' ')
  const match = node.text.match(/^<[^\s>]+\s*([^>]*)>$/)
  return match?.[1]?.trim() || ''
}

export function getNodeAtPath(roots: SecsSmlNode[], path: number[]) {
  let current: SecsSmlNode | undefined
  path.forEach((index, depth) => { current = depth === 0 ? roots[index] : current?.children[index] })
  return current
}

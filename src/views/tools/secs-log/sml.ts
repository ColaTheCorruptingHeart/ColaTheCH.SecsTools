export type SmlParseMode = 'lenient' | 'strict'

export type SmlDiagnosticCode =
  | 'no-sml-node'
  | 'unknown-data-type'
  | 'missing-node-close'
  | 'unclosed-list'
  | 'declared-count-mismatch'
  | 'unexpected-text'
  | 'unexpected-close'
  | 'nesting-depth-exceeded'
  | 'node-limit-exceeded'
  | 'input-size-exceeded'

export interface SmlParseOptions {
  mode?: SmlParseMode
  additionalTypes?: readonly string[]
  maxDepth?: number
  maxNodes?: number
  maxInputLength?: number
}

export interface SmlSourceRange {
  start: number
  end: number
  startLine: number
  endLine: number
}

export interface SmlDiagnostic {
  code: SmlDiagnosticCode
  severity: 'warning' | 'error'
  message: string
  start: number
  end: number
  line: number
  column: number
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
  terminal?: '.' | ';'
  diagnostics: SmlDiagnostic[]
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
  diagnostics: SmlDiagnostic[]
}

export interface SmlDiagnosticSummary {
  errors: number
  warnings: number
  isUsable: boolean
}

export const SML_PARSE_LIMITS = Object.freeze({
  maxDepth: 256,
  maxNodes: 100_000,
  maxInputLength: 8 * 1024 * 1024
})

const STANDARD_DATA_TYPES = new Set([
  'L', 'B', 'BOOLEAN', 'A', 'JIS8',
  'I', 'U', 'F',
  'I1', 'I2', 'I4', 'I8',
  'U1', 'U2', 'U4', 'U8',
  'F4', 'F8',
  'LIST', 'BINARY', 'BOOL', 'ASCII', 'J',
  'INT8', 'INT16', 'INT32', 'INT64',
  'UINT8', 'UINT16', 'UINT32', 'UINT64',
  'FLOAT32', 'FLOAT64'
])

function isListType(typeName: string) {
  return /^(?:L|LIST)$/i.test(typeName)
}

interface ParserContext {
  input: string
  lineStarts: number[]
  diagnostics: SmlDiagnostic[]
  mode: SmlParseMode
  knownTypes: Set<string>
  maxDepth: number
  maxNodes: number
  nodeCount: number
}

export function extractHeader(input: string) {
  const sfMatch = input.match(/\bS\s*\d+\s*F\s*\d+\b/i)
  const headerLine = sfMatch ? input.slice(sfMatch.index || 0).split(/\r?\n/, 1)[0] || '' : ''
  const wMatch = headerLine.match(/\bW\b/i)
  const sfParts = sfMatch?.[0].match(/S\s*(\d+)\s*F\s*(\d+)/i)
  const sf = sfParts ? `S${Number(sfParts[1])}F${Number(sfParts[2])}` : ''
  return `${sf}${wMatch ? ' W' : ''}`.trim()
}

export function summarizeSmlDiagnostics(
  parsed: Pick<ParsedSecsSmlTree, 'roots' | 'diagnostics'>
): SmlDiagnosticSummary {
  let errors = 0
  let warnings = 0
  parsed.diagnostics.forEach(diagnostic => {
    if (diagnostic.severity === 'error') errors += 1
    else warnings += 1
  })
  return { errors, warnings, isUsable: parsed.roots.length > 0 && errors === 0 }
}

export function formatSmlDiagnostic(diagnostic: SmlDiagnostic) {
  return `第 ${diagnostic.line} 行，第 ${diagnostic.column} 列：${diagnostic.message}`
}

function buildLineStarts(input: string) {
  const starts = [0]
  for (let index = 0; index < input.length; index += 1) {
    if (input[index] === '\n') starts.push(index + 1)
  }
  return starts
}

function getPosition(lineStarts: number[], index: number) {
  let low = 0
  let high = lineStarts.length
  while (low < high) {
    const middle = Math.floor((low + high) / 2)
    if ((lineStarts[middle] || 0) <= index) low = middle + 1
    else high = middle
  }
  const lineIndex = Math.max(0, low - 1)
  return {
    line: lineIndex + 1,
    column: index - (lineStarts[lineIndex] || 0) + 1
  }
}

function addDiagnostic(
  context: ParserContext,
  code: SmlDiagnosticCode,
  message: string,
  start: number,
  end: number,
  alwaysError = false
) {
  const position = getPosition(context.lineStarts, start)
  context.diagnostics.push({
    code,
    severity: alwaysError || context.mode === 'strict' ? 'error' : 'warning',
    message,
    start,
    end: Math.max(start + 1, end),
    ...position
  })
}

function normalizeBody(body: string) {
  const cleaned = body.replace(/\s+/g, ' ').trim()
  const typeMatch = cleaned.match(/^([A-Za-z][A-Za-z0-9]*)/)
  if (!typeMatch?.[1]) {
    return { typeName: cleaned, value: '', declaredCount: undefined, label: undefined }
  }

  const typeName = typeMatch[1]
  let remainder = cleaned.slice(typeMatch[0].length).trim()
  let declaredCount: number | undefined
  let label: string | undefined

  const commaCount = remainder.match(/^,\s*(\d+)\b/)
  if (commaCount?.[1]) {
    declaredCount = Number(commaCount[1])
    remainder = remainder.slice(commaCount[0].length).trim()
  }

  while (remainder.startsWith('[') || remainder.startsWith('{')) {
    const closeChar = remainder[0] === '[' ? ']' : '}'
    const closeIndex = remainder.indexOf(closeChar, 1)
    if (closeIndex < 0) break
    const metadata = remainder.slice(1, closeIndex).trim()
    if (declaredCount === undefined && /^\d+$/.test(metadata)) declaredCount = Number(metadata)
    else if (metadata) label = label ? `${label} ${metadata}` : metadata
    remainder = remainder.slice(closeIndex + 1).trim()
  }

  if (isListType(typeName) && declaredCount === undefined) {
    const bareCount = remainder.match(/^(\d+)\b/)
    if (bareCount?.[1]) {
      declaredCount = Number(bareCount[1])
      remainder = remainder.slice(bareCount[0].length).trim()
    }
  }

  return {
    typeName,
    value: remainder,
    declaredCount,
    label
  }
}

function splitScalarValues(value: string) {
  const values: string[] = []
  let current = ''
  let quote = ''
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index] || ''
    if (quote) {
      current += char
      if (char === '\\' && index + 1 < value.length) current += value[++index]
      else if (char === quote) quote = ''
      continue
    }
    if (char === "'" || char === '"') {
      quote = char
      current += char
    } else if (/\s/.test(char)) {
      if (current) values.push(current)
      current = ''
    } else {
      current += char
    }
  }
  if (current) values.push(current)
  return values
}

export function normalizeOpenLine(line: string) {
  const trimmed = line.trim()
  const hasClose = trimmed.endsWith('>')
  const inner = trimmed.slice(1, hasClose ? -1 : undefined).trim()
  const parsed = normalizeBody(inner)
  return `<${parsed.typeName || inner}${parsed.value ? ` ${parsed.value}` : ''}${hasClose ? '>' : ''}`
}

function readTypeAt(input: string, start: number) {
  if (input[start] !== '<') return null
  const match = input.slice(start).match(/^<\s*([A-Za-z][A-Za-z0-9]*)(?=[,\s>\[{]|$)/)
  return match?.[1] || null
}

function findNodeStart(input: string, from: number, allowedTypes?: Set<string>) {
  let cursor = input.indexOf('<', from)
  while (cursor >= 0) {
    const typeName = readTypeAt(input, cursor)
    if (typeName && (!allowedTypes || allowedTypes.has(typeName.toUpperCase()))) return cursor
    cursor = input.indexOf('<', cursor + 1)
  }
  return -1
}

function scanTagBoundary(input: string, start: number) {
  let quote = ''
  let newlineIndex = -1
  for (let index = start + 1; index < input.length; index += 1) {
    const char = input[index] || ''
    if (quote) {
      if (char === '\\') index += 1
      else if (char === quote) quote = ''
      continue
    }
    if (char === "'" || char === '"') {
      quote = char
      continue
    }
    if (char === '\n' && newlineIndex === -1) newlineIndex = index
    if (char === '<') return { tagEnd: -1, childStart: index, newlineIndex }
    if (char === '>') return { tagEnd: index, childStart: -1, newlineIndex }
  }
  return { tagEnd: -1, childStart: -1, newlineIndex }
}

function findNextStructure(input: string, from: number) {
  const nextOpen = input.indexOf('<', from)
  const nextClose = input.indexOf('>', from)
  if (nextOpen === -1) return nextClose
  if (nextClose === -1) return nextOpen
  return Math.min(nextOpen, nextClose)
}

function skipTrivia(input: string, from: number) {
  let cursor = from
  while (cursor < input.length) {
    if (/\s/.test(input[cursor] || '')) {
      cursor += 1
      continue
    }
    if (input.startsWith('/*', cursor)) {
      const end = input.indexOf('*/', cursor + 2)
      cursor = end < 0 ? input.length : end + 2
      continue
    }
    if (input.startsWith('//', cursor) || input.startsWith('--', cursor)) {
      const end = input.indexOf('\n', cursor + 2)
      cursor = end < 0 ? input.length : end + 1
      continue
    }
    break
  }
  return cursor
}

function buildNode(context: ParserContext, start: number, depth = 0): { node: SecsSmlNode; next: number } {
  const { input } = context
  const boundary = scanTagBoundary(input, start)
  let openingTagEnd = boundary.tagEnd
  let childStart = boundary.childStart
  const lineBodyEnd = boundary.newlineIndex === -1 ? input.length : boundary.newlineIndex
  const lineBody = input.slice(start + 1, lineBodyEnd)
  const lineHeader = normalizeBody(lineBody)
  const hasMultilineListHeader = boundary.newlineIndex !== -1
    && isListType(lineHeader.typeName)
    && !lineHeader.value
  if (hasMultilineListHeader) {
    openingTagEnd = -1
    childStart = boundary.newlineIndex + 1
  }

  const bodyEnd = openingTagEnd !== -1 ? openingTagEnd : (childStart === -1 ? input.length : childStart)
  const parsed = normalizeBody(input.slice(start + 1, bodyEnd))
  const typeName = parsed.typeName || input.slice(start + 1, bodyEnd).trim()
  if (childStart === -1 && openingTagEnd !== -1 && isListType(typeName)) {
    const next = skipTrivia(input, openingTagEnd + 1)
    if (readTypeAt(input, next) || input[next] === '>') childStart = next
  }

  const isList = isListType(typeName) || childStart !== -1
  const initialEnd = openingTagEnd === -1 ? input.length : openingTagEnd + 1
  const startPosition = getPosition(context.lineStarts, start)
  const endPosition = getPosition(context.lineStarts, Math.max(start, initialEnd - 1))
  const node: SecsSmlNode = {
    text: `<${typeName}${parsed.value ? ` ${parsed.value}` : ''}${childStart === -1 && openingTagEnd !== -1 ? '>' : ''}`,
    children: [],
    kind: isList ? 'list' : 'value',
    typeName,
    declaredCount: parsed.declaredCount,
    label: parsed.label,
    values: parsed.value ? splitScalarValues(parsed.value) : [],
    sourceRange: {
      start,
      end: initialEnd,
      startLine: startPosition.line,
      endLine: endPosition.line
    }
  }

  context.nodeCount += 1
  if (context.nodeCount > context.maxNodes) {
    addDiagnostic(context, 'node-limit-exceeded', `SML 节点数超过 ${context.maxNodes.toLocaleString()} 个限制`, start, input.length, true)
    return { node, next: input.length }
  }
  if (depth >= context.maxDepth && childStart !== -1) {
    addDiagnostic(context, 'nesting-depth-exceeded', `SML 嵌套深度超过 ${context.maxDepth} 层限制`, start, bodyEnd, true)
    return { node, next: input.length }
  }

  if (!context.knownTypes.has(typeName.toUpperCase())) {
    addDiagnostic(context, 'unknown-data-type', `未知数据类型 ${typeName}`, start, bodyEnd)
  }
  if (openingTagEnd === -1 && childStart === -1) {
    addDiagnostic(context, 'missing-node-close', '未找到节点结束符 >', start, input.length, true)
    return { node, next: input.length }
  }
  if (childStart === -1) return { node, next: openingTagEnd + 1 }

  let cursor = childStart
  while (cursor < input.length) {
    cursor = skipTrivia(input, cursor)
    if (input[cursor] === '>') {
      const closePosition = getPosition(context.lineStarts, cursor)
      node.sourceRange = { ...node.sourceRange!, end: cursor + 1, endLine: closePosition.line }
      if (node.declaredCount !== undefined && node.declaredCount !== node.children.length) {
        addDiagnostic(
          context,
          'declared-count-mismatch',
          `列表声明 ${node.declaredCount} 项，实际解析到 ${node.children.length} 项`,
          start,
          cursor + 1
        )
      }
      return { node, next: cursor + 1 }
    }

    const childType = readTypeAt(input, cursor)
    if (childType) {
      const child = buildNode(context, cursor, depth + 1)
      node.children.push(child.node)
      cursor = child.next
      continue
    }

    const nextStructure = findNextStructure(input, cursor + 1)
    const end = nextStructure === -1 ? input.length : nextStructure
    if (input.slice(cursor, end).trim()) {
      addDiagnostic(context, 'unexpected-text', '列表中存在未识别文本', cursor, end)
    }
    cursor = end
  }

  addDiagnostic(context, 'unclosed-list', '列表未闭合', start, input.length, true)
  return { node, next: input.length }
}

function addSkippedRootDiagnostics(context: ParserContext, start: number, end: number) {
  const closeOffset = context.input.slice(start, end).indexOf('>')
  if (closeOffset >= 0) {
    const position = start + closeOffset
    addDiagnostic(context, 'unexpected-close', '存在未匹配的列表结束符 >', position, position + 1)
  }
}

export function parseSmlTree(rawText: string, options: SmlParseOptions = {}): ParsedSecsSmlTree {
  if (!rawText || !rawText.trim()) return { header: '', roots: [], hasTerminalDot: false, diagnostics: [] }
  const terminal = rawText.match(/([.;])\s*$/)?.[1] as '.' | ';' | undefined

  const maxInputLength = options.maxInputLength ?? SML_PARSE_LIMITS.maxInputLength
  if (rawText.length > maxInputLength) {
    const context: ParserContext = {
      input: rawText,
      lineStarts: buildLineStarts(rawText),
      diagnostics: [],
      mode: options.mode || 'lenient',
      knownTypes: new Set(STANDARD_DATA_TYPES),
      maxDepth: options.maxDepth ?? SML_PARSE_LIMITS.maxDepth,
      maxNodes: options.maxNodes ?? SML_PARSE_LIMITS.maxNodes,
      nodeCount: 0
    }
    addDiagnostic(context, 'input-size-exceeded', `SML 文本超过 ${maxInputLength.toLocaleString()} 字符限制`, maxInputLength, rawText.length, true)
    return {
      header: extractHeader(rawText),
      roots: [],
      hasTerminalDot: terminal === '.',
      terminal,
      diagnostics: context.diagnostics
    }
  }

  const knownTypes = new Set(STANDARD_DATA_TYPES)
  options.additionalTypes?.forEach(typeName => knownTypes.add(typeName.toUpperCase()))
  const context: ParserContext = {
    input: rawText,
    lineStarts: buildLineStarts(rawText),
    diagnostics: [],
    mode: options.mode || 'lenient',
    knownTypes,
    maxDepth: options.maxDepth ?? SML_PARSE_LIMITS.maxDepth,
    maxNodes: options.maxNodes ?? SML_PARSE_LIMITS.maxNodes,
    nodeCount: 0
  }
  const roots: SecsSmlNode[] = []
  const firstStruct = findNodeStart(rawText, 0, knownTypes)
  if (firstStruct < 0) {
    addDiagnostic(context, 'no-sml-node', '未找到可解析的 SML 数据节点', 0, rawText.length)
    return {
      header: extractHeader(rawText) || rawText.trim(),
      roots,
      hasTerminalDot: terminal === '.',
      terminal,
      diagnostics: context.diagnostics
    }
  }

  let cursor = firstStruct
  while (cursor < rawText.length) {
    const parsed = buildNode(context, cursor)
    roots.push(parsed.node)
    const next = findNodeStart(rawText, parsed.next)
    if (next < 0) {
      addSkippedRootDiagnostics(context, parsed.next, rawText.length)
      break
    }
    addSkippedRootDiagnostics(context, parsed.next, next)
    cursor = next
  }

  return {
    header: extractHeader(rawText),
    roots,
    hasTerminalDot: terminal === '.',
    terminal,
    diagnostics: context.diagnostics
  }
}

export function pathToString(path: number[]) {
  return path.map(value => `[${value}]`).join('')
}

export function buildFormattedResult(parsed: ParsedSecsSmlTree) {
  const lines: FormattedSecsSmlLine[] = []
  if (parsed.header) lines.push({ text: parsed.header, clickable: false, path: '' })

  function walk(node: SecsSmlNode, depth: number, path: number[], isLastRoot = false) {
    const openLineIndex = lines.length
    const isLeaf = !node.children.length && node.text.endsWith('>')
    lines.push({
      text: `${'    '.repeat(depth)}${node.text}${depth === 0 && isLastRoot && isLeaf ? (parsed.terminal || '') : ''}`,
      clickable: true,
      path: pathToString(path),
      jumpToIndex: openLineIndex
    })
    if (node.children.length || !node.text.endsWith('>')) {
      node.children.forEach((child, index) => walk(child, depth + 1, path.concat(index)))
      lines.push({
        text: `${'    '.repeat(depth)}>` + (depth === 0 && isLastRoot ? (parsed.terminal || '') : ''),
        clickable: true,
        path: pathToString(path),
        jumpToIndex: openLineIndex
      })
    }
  }

  parsed.roots.forEach((root, index) => walk(root, 0, [index], index === parsed.roots.length - 1))
  if (!parsed.roots.length && parsed.header && parsed.terminal) {
    lines.push({ text: parsed.terminal, clickable: false, path: '' })
  }
  return lines
}

export function formatSecsSml(rawText: string, options: SmlParseOptions = {}): FormattedSecsSmlResult {
  const parsed = parseSmlTree(rawText, options)
  const lines = buildFormattedResult(parsed)
  return {
    lines,
    text: lines.map(line => line.text).join('\n'),
    diagnostics: parsed.diagnostics
  }
}

export function getNodeValueText(node: SecsSmlNode | undefined) {
  if (!node) return ''
  if (node.values?.length) return node.values.join(' ')
  const match = node.text.match(/^<[^\s>]+\s*([^>]*)>$/)
  return match?.[1]?.trim() || ''
}

export function getNodeAtPath(roots: SecsSmlNode[], path: number[]) {
  let current: SecsSmlNode | undefined
  path.forEach((index, depth) => {
    current = depth === 0 ? roots[index] : current?.children[index]
  })
  return current
}

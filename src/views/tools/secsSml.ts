export interface SecsSmlNode {
  text: string
  children: SecsSmlNode[]
}

export interface ParsedSecsSmlTree {
  header: string
  roots: SecsSmlNode[]
  hasTerminalDot: boolean
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
}

export function extractHeader(input: string) {
  const sfMatch = input.match(/\bS\d+F\d+\b/i)
  const wMatch = input.match(/\bW\b/)
  const sf = sfMatch ? sfMatch[0].toUpperCase() : ''
  const w = wMatch ? ' W' : ''
  return `${sf}${w}`.trim()
}

export function normalizeOpenLine(line: string) {
  const trimmed = line.trim()
  const hasClose = trimmed.endsWith('>')
  const inner = trimmed.slice(1, hasClose ? -1 : undefined).trim()

  const cleaned = inner
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  const partMatch = cleaned.match(/^([A-Za-z0-9]+)(?:,\d+)?\s*(.*)$/)
  const type = partMatch ? partMatch[1] : cleaned
  const value = partMatch && partMatch[2] ? partMatch[2].trim() : ''

  return `<${type}${value ? ' ' + value : ''}${hasClose ? '>' : ''}`
}

export function pathToString(path: number[]) {
  return path.map(value => `[${value}]`).join('')
}

export function parseSmlTree(rawText: string): ParsedSecsSmlTree {
  if (!rawText || !rawText.trim()) {
    return { header: '', roots: [], hasTerminalDot: false }
  }

  const lines = rawText.split(/\r?\n/)
  const firstStructLine = lines.findIndex(line => line.trim().startsWith('<'))
  if (firstStructLine === -1) {
    return { header: extractHeader(rawText) || rawText.trim(), roots: [], hasTerminalDot: false }
  }

  const header = extractHeader(rawText)
  const roots: SecsSmlNode[] = []
  const stack: SecsSmlNode[] = []
  let hasTerminalDot = false

  for (let index = firstStructLine; index < lines.length; index += 1) {
    const line = lines[index]?.trim() || ''
    if (!line) continue

    if (line.startsWith('<')) {
      const normalized = normalizeOpenLine(line)
      const node: SecsSmlNode = { text: normalized, children: [] }

      if (stack.length) {
        const parentNode = stack[stack.length - 1]
        if (parentNode) {
          parentNode.children.push(node)
        } else {
          roots.push(node)
        }
      } else {
        roots.push(node)
      }

      if (!normalized.endsWith('>')) {
        stack.push(node)
      }
      continue
    }

    if (line.startsWith('>')) {
      if (line.endsWith('.')) hasTerminalDot = true
      if (stack.length) stack.pop()
    }
  }

  return { header, roots, hasTerminalDot }
}

export function buildFormattedResult(parsed: ParsedSecsSmlTree) {
  const lines: FormattedSecsSmlLine[] = []

  if (parsed.header) {
    lines.push({ text: parsed.header, clickable: false, path: '' })
  }

  function walk(node: SecsSmlNode, depth: number, path: number[]) {
    const text = `${'    '.repeat(depth)}${node.text}`
    const openLineIndex = lines.length

    lines.push({
      text,
      clickable: true,
      path: pathToString(path),
      jumpToIndex: openLineIndex
    })

    if (node.children.length > 0) {
      node.children.forEach((child, index) => walk(child, depth + 1, path.concat(index)))
      lines.push({
        text: `${'    '.repeat(depth)}>` + (depth === 0 && parsed.hasTerminalDot ? '.' : ''),
        clickable: true,
        path: pathToString(path),
        jumpToIndex: openLineIndex
      })
    }
  }

  parsed.roots.forEach((root, index) => walk(root, 0, [index]))
  return lines
}

export function formatSecsSml(rawText: string): FormattedSecsSmlResult {
  const parsed = parseSmlTree(rawText)
  const lines = buildFormattedResult(parsed)
  return { lines, text: lines.map(line => line.text).join('\n') }
}

export function getNodeValueText(node: SecsSmlNode | undefined) {
  if (!node) return ''

  const match = node.text.match(/^<[^\s>]+\s*([^>]*)>$/)
  if (!match) return ''

  return match[1]?.trim() || ''
}

export function getNodeAtPath(roots: SecsSmlNode[], path: number[]) {
  let current: SecsSmlNode | undefined

  path.forEach((index, depth) => {
    if (depth === 0) {
      current = roots[index]
      return
    }

    current = current?.children[index]
  })

  return current
}

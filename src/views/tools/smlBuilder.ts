import { formatSecsSml } from './secsSml'

export const SML_VALUE_TYPES = [
  'A', 'B', 'BOOLEAN', 'JIS8',
  'I1', 'I2', 'I4', 'I8',
  'U1', 'U2', 'U4', 'U8',
  'F4', 'F8'
] as const

export type SmlValueType = (typeof SML_VALUE_TYPES)[number]
export type SmlBuilderType = 'L' | SmlValueType

export interface SmlBuilderNode {
  id: string
  type: SmlBuilderType
  label: string
  value: string
  declaredLength: number | null
  children: SmlBuilderNode[]
}

export interface SmlMessageDraft {
  stream: number
  function: number
  wait: boolean
  root: SmlBuilderNode
}

export interface SmlPreviewLine {
  key: string
  nodeId?: string
  depth: number
  text: string
  kind: 'header' | 'open' | 'value' | 'close'
}

export interface SmlBuilderIssue {
  nodeId?: string
  severity: 'error' | 'warning'
  message: string
}

export type SmlQuoteStyle = 'none' | 'double' | 'single'

export interface SmlQuoteSettings {
  numericQuote: SmlQuoteStyle
  textQuote: Exclude<SmlQuoteStyle, 'none'>
}

export const DEFAULT_SML_QUOTE_SETTINGS: Readonly<SmlQuoteSettings> = Object.freeze({
  numericQuote: 'none',
  textQuote: 'double'
})

let nodeSequence = 0

export function createNode(
  type: SmlBuilderType,
  label = '',
  value = '',
  children: SmlBuilderNode[] = [],
  declaredLength: number | null = null
): SmlBuilderNode {
  nodeSequence += 1
  return { id: `sml-node-${nodeSequence}`, type, label, value, declaredLength, children }
}

export function createS2F41Draft(): SmlMessageDraft {
  return {
    stream: 2,
    function: 41,
    wait: true,
    root: createNode('L', 'S2F41 Body', '', [
      createNode('A', 'RCMD', 'START'),
      createNode('L', 'Command Parameters', '', [
        createParameterPair('PPID', 'A', 'RCP-DEMO-01'),
        createParameterPair('PORT', 'U1', '1'),
        createParameterPair('USECLAMP', 'BOOLEAN', 'TRUE')
      ])
    ])
  }
}

export function createBlankDraft(): SmlMessageDraft {
  return {
    stream: 1,
    function: 1,
    wait: true,
    root: createNode('L', 'Message Body')
  }
}

export function createParameterPair(
  name = 'CPNAME',
  valueType: SmlValueType = 'A',
  value = ''
) {
  return createNode('L', name || 'Command Parameter', '', [
    createNode('A', 'CPNAME', name),
    createNode(valueType, 'CPVAL', value)
  ])
}

export function isNumericSmlType(type: SmlBuilderType) {
  return /^(?:I|U)(?:1|2|4|8)$/.test(type) || /^(?:F4|F8)$/.test(type)
}

function quoteSmlValue(value: string, style: SmlQuoteStyle) {
  if (style === 'none') return value
  const quote = style === 'single' ? "'" : '"'
  const escaped = value.replace(/\\/g, '\\\\').replace(new RegExp(`\\${quote}`, 'g'), `\\${quote}`)
  return `${quote}${escaped}${quote}`
}

export function getNodeQuoteStyle(
  type: SmlBuilderType,
  settings: SmlQuoteSettings = DEFAULT_SML_QUOTE_SETTINGS
): SmlQuoteStyle {
  if (type === 'A' || type === 'JIS8') return settings.textQuote
  if (isNumericSmlType(type)) return settings.numericQuote
  return 'none'
}

export function formatNodeValue(
  node: SmlBuilderNode,
  settings: SmlQuoteSettings = DEFAULT_SML_QUOTE_SETTINGS
) {
  if (node.type === 'A' || node.type === 'JIS8') {
    const characterCount = Array.from(node.value).length
    const padding = node.declaredLength !== null && node.declaredLength > characterCount
      ? ' '.repeat(node.declaredLength - characterCount)
      : ''
    return quoteSmlValue(`${node.value}${padding}`, settings.textQuote)
  }
  const value = node.value.trim()
  return isNumericSmlType(node.type) ? quoteSmlValue(value, settings.numericQuote) : value
}

export function buildPreviewLines(
  draft: SmlMessageDraft,
  settings: SmlQuoteSettings = DEFAULT_SML_QUOTE_SETTINGS
): SmlPreviewLine[] {
  const lines: SmlPreviewLine[] = [{
    key: 'header',
    depth: 0,
    text: `S${draft.stream}F${draft.function}${draft.wait ? ' W' : ''}`,
    kind: 'header'
  }]

  function walk(node: SmlBuilderNode, depth: number, isRoot = false) {
    if (node.type !== 'L') {
      const value = formatNodeValue(node, settings)
      const declaredLength = (node.type === 'A' || node.type === 'JIS8') && node.declaredLength !== null
        ? ` [${node.declaredLength}]`
        : ''
      lines.push({
        key: `${node.id}-value`,
        nodeId: node.id,
        depth,
        text: `<${node.type}${declaredLength}${value ? ` ${value}` : ''}>`,
        kind: 'value'
      })
      return
    }

    lines.push({
      key: `${node.id}-open`,
      nodeId: node.id,
      depth,
      text: `<L [${node.children.length}]`,
      kind: 'open'
    })
    node.children.forEach(child => walk(child, depth + 1))
    lines.push({
      key: `${node.id}-close`,
      nodeId: node.id,
      depth,
      text: `>${isRoot ? '.' : ''}`,
      kind: 'close'
    })
  }

  walk(draft.root, 0, true)
  return lines
}

export function serializeSmlDraft(
  draft: SmlMessageDraft,
  settings: SmlQuoteSettings = DEFAULT_SML_QUOTE_SETTINGS
) {
  return buildPreviewLines(draft, settings)
    .map(line => `${'  '.repeat(line.depth)}${line.text}`)
    .join('\n')
}

export function formatSmlDraftForCopy(
  draft: SmlMessageDraft,
  settings: SmlQuoteSettings = DEFAULT_SML_QUOTE_SETTINGS
) {
  return formatSecsSml(serializeSmlDraft(draft, settings), { mode: 'strict' })
}

export function countNodes(root: SmlBuilderNode): number {
  return 1 + root.children.reduce((total, child) => total + countNodes(child), 0)
}

export function findNode(root: SmlBuilderNode, id: string): SmlBuilderNode | undefined {
  if (root.id === id) return root
  for (const child of root.children) {
    const result = findNode(child, id)
    if (result) return result
  }
  return undefined
}

export function findParent(root: SmlBuilderNode, id: string): SmlBuilderNode | undefined {
  if (root.children.some(child => child.id === id)) return root
  for (const child of root.children) {
    const result = findParent(child, id)
    if (result) return result
  }
  return undefined
}

export function getNodePath(root: SmlBuilderNode, id: string) {
  const path: number[] = []

  function walk(node: SmlBuilderNode): boolean {
    if (node.id === id) return true
    for (let index = 0; index < node.children.length; index += 1) {
      path.push(index)
      if (walk(node.children[index]!)) return true
      path.pop()
    }
    return false
  }

  return walk(root) ? `[0]${path.map(index => `[${index}]`).join('')}` : ''
}

export function cloneNode(node: SmlBuilderNode): SmlBuilderNode {
  return createNode(
    node.type,
    node.label,
    node.value,
    node.children.map(child => cloneNode(child)),
    node.declaredLength
  )
}

function validateInteger(node: SmlBuilderNode, bits: number, unsigned: boolean) {
  const values = node.value.trim().split(/\s+/).filter(Boolean)
  if (!values.length) return ['需要输入一个整数']
  const min = unsigned ? 0n : -(2n ** BigInt(bits - 1))
  const max = unsigned ? 2n ** BigInt(bits) - 1n : 2n ** BigInt(bits - 1) - 1n
  for (const value of values) {
    if (!/^[+-]?\d+$/.test(value)) return [`“${value}”不是有效整数`]
    const parsed = BigInt(value)
    if (parsed < min || parsed > max) return [`${value} 超出 ${node.type} 范围`]
  }
  return []
}

export function validateSmlDraft(draft: SmlMessageDraft, template: 's2f41' | 'blank') {
  const issues: SmlBuilderIssue[] = []
  if (!Number.isInteger(draft.stream) || draft.stream < 0 || draft.stream > 255) {
    issues.push({ severity: 'error', message: 'Stream 必须是 0 到 255 的整数' })
  }
  if (!Number.isInteger(draft.function) || draft.function < 0 || draft.function > 255) {
    issues.push({ severity: 'error', message: 'Function 必须是 0 到 255 的整数' })
  }

  function walk(node: SmlBuilderNode) {
    if (node.type !== 'L') {
      if (node.type === 'A' || node.type === 'JIS8') {
        if (node.declaredLength !== null && (!Number.isInteger(node.declaredLength) || node.declaredLength < 0)) {
          issues.push({ nodeId: node.id, severity: 'error', message: `${node.label || node.type} 的字符长度必须是非负整数` })
        } else if (node.declaredLength !== null) {
          const characterCount = Array.from(node.value).length
          if (characterCount > node.declaredLength) {
            issues.push({
              nodeId: node.id,
              severity: 'error',
              message: `${node.label || node.type} 当前 ${characterCount} 个字符，超过声明长度 ${node.declaredLength}`
            })
          }
        }
      }

      if (!node.value.trim() && node.type !== 'A' && node.type !== 'JIS8') {
        issues.push({ nodeId: node.id, severity: 'error', message: `${node.label || node.type} 需要填写值` })
      }

      const integerMatch = node.type.match(/^([IU])(1|2|4|8)$/)
      if (integerMatch) {
        const bitWidth = Number(integerMatch[2]) * 8
        validateInteger(node, bitWidth, integerMatch[1] === 'U').forEach(message => {
          issues.push({ nodeId: node.id, severity: 'error', message })
        })
      }

      if (node.type === 'BOOLEAN') {
        const values = node.value.trim().split(/\s+/).filter(Boolean)
        if (!values.length || values.some(value => !/^(?:TRUE|FALSE|0|1)$/i.test(value))) {
          issues.push({ nodeId: node.id, severity: 'error', message: 'BOOLEAN 仅支持 TRUE、FALSE、0 或 1' })
        }
      }
    }
    node.children.forEach(walk)
  }
  walk(draft.root)

  if (template === 's2f41') {
    if (draft.stream !== 2 || draft.function !== 41) {
      issues.push({ severity: 'warning', message: '当前模板的标准报文头为 S2F41' })
    }
    if (draft.root.type !== 'L' || draft.root.children.length !== 2) {
      issues.push({ nodeId: draft.root.id, severity: 'error', message: 'S2F41 Body 必须是包含 2 项的 List' })
    } else {
      const [rcmd, parameters] = draft.root.children
      if (rcmd?.type !== 'A') {
        issues.push({ nodeId: rcmd?.id, severity: 'error', message: 'RCMD 应使用 ASCII 类型' })
      }
      if (!rcmd?.value.trim()) {
        issues.push({ nodeId: rcmd?.id, severity: 'error', message: 'RCMD 不能为空' })
      }
      if (parameters?.type !== 'L') {
        issues.push({ nodeId: parameters?.id, severity: 'error', message: 'Command Parameters 必须是 List' })
      } else {
        const names = new Set<string>()
        parameters.children.forEach((pair, index) => {
          const [name, value] = pair.children
          if (pair.type !== 'L' || pair.children.length !== 2) {
            issues.push({ nodeId: pair.id, severity: 'error', message: `第 ${index + 1} 个参数必须是包含 2 项的 List` })
            return
          }
          if (name?.type !== 'A' || !name.value.trim()) {
            issues.push({ nodeId: name?.id || pair.id, severity: 'error', message: `第 ${index + 1} 个 CPNAME 必须是非空 ASCII` })
          } else {
            const normalizedName = name.value.trim().toUpperCase()
            if (names.has(normalizedName)) {
              issues.push({ nodeId: name.id, severity: 'warning', message: `CPNAME “${name.value}”重复` })
            }
            names.add(normalizedName)
          }
          if (!value) {
            issues.push({ nodeId: pair.id, severity: 'error', message: `第 ${index + 1} 个参数缺少 CPVAL` })
          }
        })
      }
    }
  }

  return issues
}

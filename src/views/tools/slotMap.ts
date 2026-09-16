import { formatSecsSml, getNodeValueText, parseSmlTree } from './secsSml'

export const SLOT_COUNT = 25

export interface SlotValueMapping {
  occupiedDigit: string
  emptyDigit: string
}

export interface ParsedSlotSmlList {
  selection: boolean[]
  formattedText: string
}

export const DEFAULT_SLOT_VALUE_MAPPING: SlotValueMapping = {
  occupiedDigit: '1',
  emptyDigit: '0'
}

export function assertSlotValueMapping(mapping: SlotValueMapping) {
  if (!/^\d$/.test(mapping.occupiedDigit) || !/^\d$/.test(mapping.emptyDigit)) {
    throw new Error('有片值和空槽值必须是 0 到 9 的单个数字')
  }

  if (mapping.occupiedDigit === mapping.emptyDigit) {
    throw new Error('有片值和空槽值不能相同')
  }
}

function getMappedDigit(selected: boolean, mapping: SlotValueMapping, inverted: boolean) {
  const occupiedDigit = inverted ? mapping.emptyDigit : mapping.occupiedDigit
  const emptyDigit = inverted ? mapping.occupiedDigit : mapping.emptyDigit
  return selected ? occupiedDigit : emptyDigit
}

export function serializeSelectionToMappedMap(
  selection: readonly boolean[],
  mapping: SlotValueMapping,
  inverted = false
) {
  assertSlotValueMapping(mapping)
  return selection.map(selected => getMappedDigit(selected, mapping, inverted)).join('')
}

export function parseMappedMapText(
  rawText: string,
  mapping: SlotValueMapping,
  inverted = false
) {
  assertSlotValueMapping(mapping)
  const normalized = rawText.replace(/[\s，,]/g, '')
  const allowedDigits = new Set([mapping.occupiedDigit, mapping.emptyDigit])

  if (normalized.length !== SLOT_COUNT || [...normalized].some(digit => !allowedDigits.has(digit))) {
    throw new Error(
      `map 格式无效，请输入 ${SLOT_COUNT} 位仅包含 ${mapping.occupiedDigit} 和 ${mapping.emptyDigit} 的字符串`
    )
  }

  const selectedDigit = inverted ? mapping.emptyDigit : mapping.occupiedDigit
  return [...normalized].map(digit => digit === selectedDigit)
}

export function serializeSelectionToSmlList(
  selection: readonly boolean[],
  mapping: SlotValueMapping,
  inverted = false
) {
  assertSlotValueMapping(mapping)
  const items = selection.map(selected => `    <U1 ${getMappedDigit(selected, mapping, inverted)}>`)
  return ['<L', ...items, '>'].join('\n')
}

export function parseSlotSmlList(
  rawText: string,
  mapping: SlotValueMapping,
  inverted = false
): ParsedSlotSmlList {
  assertSlotValueMapping(mapping)
  if (!rawText.trim()) {
    throw new Error('请输入纵向 U1 List')
  }

  const formatted = formatSecsSml(rawText, { mode: 'strict' })
  const firstError = formatted.diagnostics.find(diagnostic => diagnostic.severity === 'error')
  if (firstError) {
    throw new Error(`SML 第 ${firstError.line} 行第 ${firstError.column} 列：${firstError.message}`)
  }

  const parsed = parseSmlTree(formatted.text, { mode: 'strict' })
  const root = parsed.roots[0]
  if (parsed.header || parsed.roots.length !== 1 || root?.kind !== 'list') {
    throw new Error('纵向 List 只能包含一个 L 根列表，不应包含 SxFy 报文头')
  }

  if (root.children.length !== SLOT_COUNT) {
    throw new Error(`纵向 List 必须包含 ${SLOT_COUNT} 个 U1 槽位，当前为 ${root.children.length} 个`)
  }

  const values = root.children.map((node, index) => {
    const value = getNodeValueText(node)
    if (node.kind !== 'value' || node.typeName?.toUpperCase() !== 'U1' || !/^\d$/.test(value)) {
      throw new Error(`第 ${index + 1} 个槽位必须是仅含单个数字的 <U1 n> 节点`)
    }
    return value
  })

  const mapText = values.join('')
  return {
    selection: parseMappedMapText(mapText, mapping, inverted),
    formattedText: formatted.text
  }
}

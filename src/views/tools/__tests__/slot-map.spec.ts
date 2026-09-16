import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SLOT_VALUE_MAPPING,
  parseMappedMapText,
  parseSlotSmlList,
  serializeSelectionToMappedMap,
  serializeSelectionToSmlList
} from '../slotMap'

const selection = Array.from({ length: 25 }, (_, index) => [2, 14, 24].includes(index))

describe('slot map custom mapping', () => {
  it('serializes default and inverted maps', () => {
    expect(serializeSelectionToMappedMap(selection, DEFAULT_SLOT_VALUE_MAPPING))
      .toBe('0010000000000010000000001')
    expect(serializeSelectionToMappedMap(selection, DEFAULT_SLOT_VALUE_MAPPING, true))
      .toBe('1101111111111101111111110')
  })

  it('round-trips a custom single-digit mapping', () => {
    const mapping = { occupiedDigit: '7', emptyDigit: '2' }
    const map = serializeSelectionToMappedMap(selection, mapping)
    const invertedMap = serializeSelectionToMappedMap(selection, mapping, true)

    expect(parseMappedMapText(map, mapping)).toEqual(selection)
    expect(parseMappedMapText(invertedMap, mapping, true)).toEqual(selection)
  })

  it('rejects ambiguous or non-single-digit mappings', () => {
    expect(() => serializeSelectionToMappedMap(selection, { occupiedDigit: '5', emptyDigit: '5' }))
      .toThrow('不能相同')
    expect(() => serializeSelectionToMappedMap(selection, { occupiedDigit: '10', emptyDigit: '0' }))
      .toThrow('单个数字')
  })

  it('renders vertical U1 lists and their inverse', () => {
    const mapping = { occupiedDigit: '7', emptyDigit: '2' }
    const list = serializeSelectionToSmlList(selection, mapping)
    const invertedList = serializeSelectionToSmlList(selection, mapping, true)

    expect(list.split('\n')).toHaveLength(27)
    expect(list).toContain('  <U1 7>')
    expect(invertedList.split('\n')[3]).toBe('    <U1 2>')
    expect(invertedList.split('\n')[1]).toBe('    <U1 7>')
  })

  it('strictly formats and parses an editable U1 list', () => {
    const mapping = { occupiedDigit: '7', emptyDigit: '2' }
    const rawList = `<L,25\n${selection.map(selected => `<U1 ${selected ? '7' : '2'}>`).join('\n')}\n>`
    const result = parseSlotSmlList(rawList, mapping)

    expect(result.selection).toEqual(selection)
    expect(result.formattedText.split('\n')[1]).toBe('    <U1 2>')
  })

  it('rejects malformed lists, wrong node counts, and non-U1 values', () => {
    expect(() => parseSlotSmlList('<L\n<U1 0>\n>', DEFAULT_SLOT_VALUE_MAPPING))
      .toThrow('必须包含 25 个 U1')
    expect(() => parseSlotSmlList(`<L\n${'<U2 0>\n'.repeat(25)}>`, DEFAULT_SLOT_VALUE_MAPPING))
      .toThrow('必须是仅含单个数字的 <U1 n>')
    expect(() => parseSlotSmlList(`<L\n${'<U1 0>\n'.repeat(25)}`, DEFAULT_SLOT_VALUE_MAPPING))
      .toThrow('SML 第')
  })
})

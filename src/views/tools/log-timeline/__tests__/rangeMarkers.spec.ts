import { describe, expect, it } from 'vitest'
import { buildRangeMarkerTimeline } from '../rangeMarkers'
import type { LogMessageBlock, TimelineItem } from '../types'

const logContent = `01:00:00 SEND S6F11
<L,0
>.

01:00:01 SEND S1F1
<L,0
>.`

const firstBlock: LogMessageBlock = { startLine: 1, contentStartLine: 1, endLine: 3 }
const secondBlock: LogMessageBlock = { startLine: 5, contentStartLine: 5, endLine: 7 }

const firstItem: TimelineItem = {
  time: '01:00:00',
  sxFy: 'S6F11',
  ceid: '5',
  desc: 'Event',
  line: 2,
  type: 'CEID'
}

describe('range marker timeline', () => {
  it('marks every existing timeline item in the selected message block', () => {
    const items = [firstItem, { ...firstItem, ceid: '6', line: 3 }]
    const result = buildRangeMarkerTimeline(items, logContent, [
      { kind: 'start', block: firstBlock }
    ])

    expect(result).toHaveLength(2)
    expect(result.every(item => item.rangeMarkers?.includes('start'))).toBe(true)
    expect(result.every(item => item.type !== 'RangeMarker')).toBe(true)
  })

  it('inserts a virtual marker when the selected block has no timeline item', () => {
    const result = buildRangeMarkerTimeline([firstItem], logContent, [
      { kind: 'end', block: secondBlock }
    ])

    expect(result).toHaveLength(2)
    expect(result[1]).toEqual(expect.objectContaining({
      type: 'RangeMarker',
      time: '01:00:01.000',
      sxFy: 'S1F1',
      desc: '区间结束点',
      line: 5,
      rangeMarkers: ['end']
    }))
  })

  it('combines start and end markers when both point to the same block', () => {
    const result = buildRangeMarkerTimeline([], logContent, [
      { kind: 'start', block: secondBlock },
      { kind: 'end', block: secondBlock }
    ])

    expect(result).toEqual([
      expect.objectContaining({
        type: 'RangeMarker',
        desc: '区间起始点 / 区间结束点',
        rangeMarkers: ['start', 'end']
      })
    ])
  })

  it('returns the original array when no range point is selected', () => {
    const items = [firstItem]
    expect(buildRangeMarkerTimeline(items, logContent, [])).toBe(items)
  })
})

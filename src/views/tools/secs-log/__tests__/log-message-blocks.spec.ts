import { describe, expect, it } from 'vitest'
import { buildLogMessageBlocks, splitLogLines } from '../log-message-blocks'
import { MULTI_DIALECT_LOG, STANDALONE_S2F41 } from './fixtures'

describe('SECS log message blocks', () => {
  it('splits mixed supported dialects into independent messages', () => {
    const blocks = buildLogMessageBlocks(splitLogLines(MULTI_DIALECT_LOG))

    expect(blocks).toHaveLength(3)
    expect(blocks.map(block => block.contentStartLine)).toEqual([1, 16, 24])
  })

  it('accepts standalone pure SML as a message block', () => {
    const blocks = buildLogMessageBlocks(splitLogLines(STANDALONE_S2F41))

    expect(blocks).toEqual([{ startLine: 1, contentStartLine: 1, endLine: 10 }])
  })

  it('pairs a timestamp-only line with a following SxFy line', () => {
    const text = `[2026-08-06 01:00:00.123] trace\nS6F11 W\n<L,0\n>.`

    expect(buildLogMessageBlocks(splitLogLines(text))).toEqual([
      { startLine: 1, contentStartLine: 2, endLine: 4 }
    ])
  })
})

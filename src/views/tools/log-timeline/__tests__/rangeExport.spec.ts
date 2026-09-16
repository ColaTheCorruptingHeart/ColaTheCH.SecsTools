import { describe, expect, it } from 'vitest'
import { buildRangeExportFileName, buildStructuredExportFileName } from '../rangeExport'

describe('log timeline export file names', () => {
  it('builds a traceable file name and sanitizes user-provided segments', () => {
    expect(buildStructuredExportFileName({
      machineId: ' EQ/01 ',
      batchId: 'LOT 42:*',
      fallbackSegment: 'timeline-hits',
      logDate: '2026-09-16',
      contentHash: 'A1B2C3D4E5F6',
      extension: '.log'
    })).toBe('EQ-01_LOT-42_2026-09-16_A1B2C3D4E5F6.log')
  })

  it('uses the export type when no batch id is provided', () => {
    expect(buildStructuredExportFileName({
      machineId: '',
      batchId: '',
      fallbackSegment: 'timeline-command-set',
      logDate: '',
      contentHash: 'ABC123',
      extension: 'zip'
    })).toBe('timeline-command-set_unknown-date_ABC123.zip')
  })

  it('keeps marked-range exports on the shared naming convention', () => {
    expect(buildRangeExportFileName({
      machineId: 'EQ01',
      batchId: '',
      startLine: 12,
      endLine: 34,
      logDate: '2026-09-16',
      contentHash: 'ABC123'
    })).toBe('EQ01_L12-L34_2026-09-16_ABC123.log')
  })
})

import type { SecsFieldDiff, SecsSemanticEvent } from './types'

export function diffEventAttributes(baseline: SecsSemanticEvent, target: SecsSemanticEvent): SecsFieldDiff[] {
  const fieldNames = new Set([...Object.keys(baseline.attributes), ...Object.keys(target.attributes)])
  const fieldDiffs: SecsFieldDiff[] = []

  fieldNames.forEach(field => {
    const baselineValue = baseline.attributes[field] || ''
    const targetValue = target.attributes[field] || ''
    if (baselineValue !== targetValue) {
      fieldDiffs.push({ field, baselineValue, targetValue })
    }
  })

  if (baseline.key !== target.key) {
    fieldDiffs.unshift({
      field: 'key',
      baselineValue: baseline.key,
      targetValue: target.key
    })
  }

  return fieldDiffs
}

import { diffLines, type Change } from 'diff'

export type DiffBarKind = 'insert' | 'delete' | 'replace'

export interface RawDiffBarMark {
  kind: DiffBarKind
  startLine: number
  lineCount: number
}

export interface DiffBarMark {
  kind: DiffBarKind
  top: number
  height: number
}

const DEFAULT_MAX_DIFF_BAR_MARKS = 420

function getChangeLineCount(change: Change) {
  const value = change.value.replace(/\n$/, '')
  if (!value) {
    return 0
  }

  return value.split('\n').length
}

function getDiffBarPriority(kind: DiffBarKind) {
  if (kind === 'replace') {
    return 3
  }

  return 2
}

function toPercentMarks(marks: RawDiffBarMark[], totalLines: number): DiffBarMark[] {
  return marks.map(mark => ({
    kind: mark.kind,
    top: Math.max(0, Math.min(100, (mark.startLine / totalLines) * 100)),
    height: Math.max(0.45, Math.min(100, (mark.lineCount / totalLines) * 100))
  }))
}

function mergeRawDiffBarMarks(marks: RawDiffBarMark[]) {
  const merged: RawDiffBarMark[] = []

  marks.forEach(mark => {
    if (mark.lineCount <= 0) {
      return
    }

    const previous = merged[merged.length - 1]
    if (previous && previous.kind === mark.kind && mark.startLine <= previous.startLine + previous.lineCount + 1) {
      previous.lineCount = Math.max(previous.lineCount, mark.startLine + mark.lineCount - previous.startLine)
      return
    }

    merged.push({ ...mark })
  })

  return merged
}

function aggregateDiffBarMarks(marks: RawDiffBarMark[], totalLines: number, maxMarks: number): DiffBarMark[] {
  const buckets: Array<DiffBarKind | null> = Array.from({ length: maxMarks }, () => null)

  marks.forEach(mark => {
    const startBucket = Math.max(0, Math.floor((mark.startLine / totalLines) * maxMarks))
    const endBucket = Math.min(
      maxMarks - 1,
      Math.floor(((mark.startLine + mark.lineCount) / totalLines) * maxMarks)
    )

    for (let bucketIndex = startBucket; bucketIndex <= endBucket; bucketIndex += 1) {
      const current = buckets[bucketIndex]
      if (!current || getDiffBarPriority(mark.kind) >= getDiffBarPriority(current)) {
        buckets[bucketIndex] = mark.kind
      }
    }
  })

  const aggregated: RawDiffBarMark[] = []
  buckets.forEach((kind, bucketIndex) => {
    if (!kind) {
      return
    }

    const startLine = (bucketIndex / maxMarks) * totalLines
    const lineCount = totalLines / maxMarks
    const previous = aggregated[aggregated.length - 1]

    if (previous && previous.kind === kind) {
      previous.lineCount += lineCount
      return
    }

    aggregated.push({ kind, startLine, lineCount })
  })

  return toPercentMarks(aggregated, totalLines)
}

export function buildDiffBarMarks(
  oldText: string,
  newText: string,
  maxMarks = DEFAULT_MAX_DIFF_BAR_MARKS
): DiffBarMark[] {
  const changes = diffLines(oldText, newText)
  const rawMarks: RawDiffBarMark[] = []
  let visualLine = 0

  for (let index = 0; index < changes.length; index += 1) {
    const change = changes[index]
    if (!change) {
      continue
    }

    const nextChange = changes[index + 1]
    const lineCount = getChangeLineCount(change)

    if (change.removed && nextChange?.added) {
      const nextLineCount = getChangeLineCount(nextChange)
      const pairedLineCount = Math.max(lineCount, nextLineCount)
      rawMarks.push({ kind: 'replace', startLine: visualLine, lineCount: pairedLineCount })
      visualLine += pairedLineCount
      index += 1
      continue
    }

    if (change.removed) {
      rawMarks.push({ kind: 'delete', startLine: visualLine, lineCount })
      visualLine += lineCount
      continue
    }

    if (change.added) {
      rawMarks.push({ kind: 'insert', startLine: visualLine, lineCount })
      visualLine += lineCount
      continue
    }

    visualLine += lineCount
  }

  const mergedMarks = mergeRawDiffBarMarks(rawMarks)
  if (!visualLine || mergedMarks.length === 0) {
    return []
  }

  if (mergedMarks.length > maxMarks) {
    return aggregateDiffBarMarks(mergedMarks, visualLine, maxMarks)
  }

  return toPercentMarks(mergedMarks, visualLine)
}

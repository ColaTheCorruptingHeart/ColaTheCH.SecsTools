export type LineDiffKind = 'equal' | 'delete' | 'insert' | 'replace'

export interface LineDiffRow {
  kind: LineDiffKind
  left: string
  right: string
}

export function splitDiffLines(text: string) {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
}

export function compactReplaceRows(rows: LineDiffRow[]) {
  const compacted: LineDiffRow[] = []

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    const nextRow = rows[index + 1]

    if (row?.kind === 'delete' && nextRow?.kind === 'insert') {
      compacted.push({ kind: 'replace', left: row.left, right: nextRow.right })
      index += 1
      continue
    }

    if (row?.kind === 'insert' && nextRow?.kind === 'delete') {
      compacted.push({ kind: 'replace', left: nextRow.left, right: row.right })
      index += 1
      continue
    }

    if (row) {
      compacted.push(row)
    }
  }

  return compacted
}

export function buildLineDiff(leftLines: string[], rightLines: string[]) {
  const leftLength = leftLines.length
  const rightLength = rightLines.length
  const matrix: number[][] = Array.from({ length: leftLength + 1 }, () => Array(rightLength + 1).fill(0))
  const getMatrixValue = (leftIndex: number, rightIndex: number) => matrix[leftIndex]?.[rightIndex] ?? 0

  for (let leftIndex = leftLength - 1; leftIndex >= 0; leftIndex -= 1) {
    for (let rightIndex = rightLength - 1; rightIndex >= 0; rightIndex -= 1) {
      if (leftLines[leftIndex] === rightLines[rightIndex]) {
        matrix[leftIndex]![rightIndex] = getMatrixValue(leftIndex + 1, rightIndex + 1) + 1
      } else {
        matrix[leftIndex]![rightIndex] = Math.max(getMatrixValue(leftIndex + 1, rightIndex), getMatrixValue(leftIndex, rightIndex + 1))
      }
    }
  }

  const rows: LineDiffRow[] = []
  let leftIndex = 0
  let rightIndex = 0

  while (leftIndex < leftLength && rightIndex < rightLength) {
    if (leftLines[leftIndex] === rightLines[rightIndex]) {
      rows.push({ kind: 'equal', left: leftLines[leftIndex] ?? '', right: rightLines[rightIndex] ?? '' })
      leftIndex += 1
      rightIndex += 1
    } else if (getMatrixValue(leftIndex + 1, rightIndex) >= getMatrixValue(leftIndex, rightIndex + 1)) {
      rows.push({ kind: 'delete', left: leftLines[leftIndex] ?? '', right: '' })
      leftIndex += 1
    } else {
      rows.push({ kind: 'insert', left: '', right: rightLines[rightIndex] ?? '' })
      rightIndex += 1
    }
  }

  while (leftIndex < leftLength) {
    rows.push({ kind: 'delete', left: leftLines[leftIndex] ?? '', right: '' })
    leftIndex += 1
  }

  while (rightIndex < rightLength) {
    rows.push({ kind: 'insert', left: '', right: rightLines[rightIndex] ?? '' })
    rightIndex += 1
  }

  return compactReplaceRows(rows)
}

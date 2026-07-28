export interface TextMetrics {
  chars: number
  lines: number
}

export function countLines(text: string) {
  if (!text) {
    return 0
  }

  let lineCount = 1
  for (let index = 0; index < text.length; index += 1) {
    if (text.charCodeAt(index) === 10) {
      lineCount += 1
    }
  }

  return lineCount
}

export function measureText(text: string): TextMetrics {
  return {
    chars: text.length,
    lines: countLines(text)
  }
}

export function formatTextMetrics(metrics: TextMetrics) {
  return `${metrics.lines.toLocaleString()} lines / ${metrics.chars.toLocaleString()} chars`
}

import SparkMD5 from 'spark-md5'
import type { RecipeBodyBasicAnalysis, RecipeBodyCandidateFormat, RecipeBodyNewlineStats } from './types'

export async function analyzeRecipeBodyBytes(bytes: Uint8Array): Promise<RecipeBodyBasicAnalysis> {
  const hashes = await buildHashes(bytes)
  const entropy = calculateEntropy(bytes)
  const readability = calculateReadability(bytes)
  const newlineStats = calculateNewlineStats(bytes)
  const magicMatches = detectMagicNumbers(bytes)
  const candidateFormats = buildCandidateFormats({
    bytes,
    entropy,
    printableAsciiRatio: readability.printableAsciiRatio,
    nullByteRatio: readability.nullByteRatio,
    highByteRatio: readability.highByteRatio,
    magicMatches,
  })
  const warnings = buildWarnings({ entropy, newlineStats, nullByteRatio: readability.nullByteRatio, magicMatches })

  return {
    hashes,
    entropy,
    printableAsciiRatio: readability.printableAsciiRatio,
    controlCharRatio: readability.controlCharRatio,
    nullByteRatio: readability.nullByteRatio,
    highByteRatio: readability.highByteRatio,
    tabCount: readability.tabCount,
    newlineStats,
    magicMatches,
    candidateFormats,
    warnings,
  }
}

async function buildHashes(bytes: Uint8Array) {
  const buffer = bytes.slice().buffer
  const [sha1, sha256, sha512] = await Promise.all([
    digestHex('SHA-1', buffer),
    digestHex('SHA-256', buffer),
    digestHex('SHA-512', buffer),
  ])

  return {
    md5: SparkMD5.ArrayBuffer.hash(buffer),
    sha1,
    sha256,
    sha512,
  }
}

async function digestHex(algorithm: 'SHA-1' | 'SHA-256' | 'SHA-512', buffer: BufferSource) {
  const digest = await crypto.subtle.digest(algorithm, buffer)
  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')
}

function calculateEntropy(bytes: Uint8Array) {
  if (!bytes.length) return 0

  const counts = new Array<number>(256).fill(0)
  bytes.forEach(byte => {
    counts[byte] = (counts[byte] ?? 0) + 1
  })

  let entropy = 0
  counts.forEach(count => {
    if (!count) return
    const probability = count / bytes.length
    entropy -= probability * Math.log2(probability)
  })

  return entropy
}

function calculateReadability(bytes: Uint8Array) {
  if (!bytes.length) {
    return {
      printableAsciiRatio: 0,
      controlCharRatio: 0,
      nullByteRatio: 0,
      highByteRatio: 0,
      tabCount: 0,
    }
  }

  let printableAscii = 0
  let controlChars = 0
  let nullBytes = 0
  let highBytes = 0
  let tabCount = 0

  bytes.forEach(byte => {
    if (byte === 0x00) {
      nullBytes += 1
    }
    if (byte === 0x09) {
      tabCount += 1
    }
    if (byte >= 0x80) {
      highBytes += 1
    }
    if (byte >= 0x20 && byte <= 0x7e) {
      printableAscii += 1
      return
    }
    if (byte < 0x20 || byte === 0x7f) {
      controlChars += 1
    }
  })

  return {
    printableAsciiRatio: printableAscii / bytes.length,
    controlCharRatio: controlChars / bytes.length,
    nullByteRatio: nullBytes / bytes.length,
    highByteRatio: highBytes / bytes.length,
    tabCount,
  }
}

function calculateNewlineStats(bytes: Uint8Array): RecipeBodyNewlineStats {
  let lf = 0
  let cr = 0
  let crlf = 0

  for (let index = 0; index < bytes.length; index += 1) {
    const current = bytes[index]
    const next = bytes[index + 1]

    if (current === 0x0d && next === 0x0a) {
      crlf += 1
      index += 1
      continue
    }

    if (current === 0x0a) {
      lf += 1
      continue
    }

    if (current === 0x0d) {
      cr += 1
    }
  }

  const nonZeroKinds = [lf, cr, crlf].filter(value => value > 0).length
  return {
    lf,
    cr,
    crlf,
    mixed: nonZeroKinds > 1,
  }
}

function detectMagicNumbers(bytes: Uint8Array) {
  const matches: string[] = []

  if (hasPrefix(bytes, [0x50, 0x4b, 0x03, 0x04])) matches.push('ZIP')
  if (hasPrefix(bytes, [0x1f, 0x8b])) matches.push('GZIP')
  if (hasPrefix(bytes, [0x78, 0x01]) || hasPrefix(bytes, [0x78, 0x9c]) || hasPrefix(bytes, [0x78, 0xda])) {
    matches.push('ZLIB')
  }
  if (hasPrefix(bytes, [0x3c, 0x3f, 0x78, 0x6d, 0x6c])) matches.push('XML')
  if (hasPrefix(bytes, [0xef, 0xbb, 0xbf])) matches.push('UTF-8 BOM')
  if (hasPrefix(bytes, [0xff, 0xfe])) matches.push('UTF-16LE BOM')
  if (hasPrefix(bytes, [0xfe, 0xff])) matches.push('UTF-16BE BOM')
  if (looksLikeTar(bytes)) matches.push('TAR')

  return matches
}

function hasPrefix(bytes: Uint8Array, prefix: number[]) {
  if (bytes.length < prefix.length) return false
  return prefix.every((value, index) => bytes[index] === value)
}

function looksLikeTar(bytes: Uint8Array) {
  if (bytes.length < 262) return false
  const marker = Array.from(bytes.slice(257, 262))
    .map(byte => String.fromCharCode(byte))
    .join('')
  return marker === 'ustar'
}

function buildCandidateFormats(args: {
  bytes: Uint8Array
  entropy: number
  printableAsciiRatio: number
  nullByteRatio: number
  highByteRatio: number
  magicMatches: string[]
}) {
  const candidates: RecipeBodyCandidateFormat[] = []

  args.magicMatches.forEach(match => {
    candidates.push({
      label: match,
      confidence: match === 'TAR' ? 0.96 : 0.99,
      reason: `检测到 ${match} 特征头或归档标记`,
    })
  })

  if (args.printableAsciiRatio >= 0.95 && args.nullByteRatio <= 0.02 && args.highByteRatio <= 0.05) {
    candidates.push({
      label: 'ASCII 文本',
      confidence: 0.93,
      reason: '可打印 ASCII 占比高，NULL 与高位字节占比较低',
    })
  } else if (args.printableAsciiRatio >= 0.8 && args.nullByteRatio <= 0.1) {
    candidates.push({
      label: '普通文本',
      confidence: 0.81,
      reason: '文本可读性较高，可能为 ASCII 或其他单字节文本格式',
    })
  }

  if (args.nullByteRatio >= 0.15) {
    candidates.push({
      label: '二进制或定长填充数据',
      confidence: 0.76,
      reason: 'NULL 字节比例较高，可能包含填充或固定长度字段',
    })
  }

  if (args.entropy >= 7.5) {
    candidates.push({
      label: '高熵数据',
      confidence: 0.79,
      reason: '熵值较高，可能为压缩、加密或私有二进制格式',
    })
  }

  if (!candidates.length) {
    candidates.push({
      label: '待人工研判',
      confidence: 0.5,
      reason: '当前特征不足以给出更明确的候选格式结论',
    })
  }

  return candidates.sort((left, right) => right.confidence - left.confidence)
}

function buildWarnings(args: {
  entropy: number
  newlineStats: RecipeBodyNewlineStats
  nullByteRatio: number
  magicMatches: string[]
}) {
  const warnings: string[] = []

  if (args.entropy >= 7.5) {
    warnings.push('该数据熵值较高，可能是压缩、加密或厂商私有二进制格式。')
  }
  if (args.nullByteRatio >= 0.15) {
    warnings.push('检测到较多 NULL 字节，可能是二进制、定长填充或 UTF-16 类内容。')
  }
  if (args.newlineStats.mixed) {
    warnings.push('检测到换行符混用，后续导出或比对时需要特别确认格式要求。')
  }
  if (args.magicMatches.some(match => ['ZIP', 'GZIP', 'ZLIB', 'TAR'].includes(match))) {
    warnings.push('检测到压缩或归档特征，分析结果应区分原始字节与解压后的预览内容。')
  }

  return warnings
}

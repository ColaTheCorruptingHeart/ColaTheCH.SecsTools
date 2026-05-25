import type {
  RecipeBodyBasicAnalysis,
  RecipeBodyDetectionResult,
  RecipeBodyNormalizationResult,
  RecipeBodyNormalizeOptions,
  RecipeBodyOutputResult,
  RecipeBodyResolvedInputType,
  RecipeBodyTextEncodingRecommendation,
  RecipeTextEncoding,
} from './types'

export async function normalizeRecipeBodyInput(
  options: RecipeBodyNormalizeOptions,
): Promise<RecipeBodyNormalizationResult> {
  const rawText = options.text
  if (!rawText.length) {
    throw new Error('请输入待分析的内容')
  }

  const detection =
    options.inputType === 'auto'
      ? detectRecipeBodyInput(rawText)
      : { resolvedType: options.inputType, warnings: [] as string[] }

  const sourceType = detection.resolvedType as RecipeBodyResolvedInputType
  const rawBytes = parseByType(sourceType, rawText)

  return buildNormalizationResult({
    rawBytes,
    sourceType,
    warnings: detection.warnings,
    inputSize: rawText.length,
  })
}

export function detectRecipeBodyInput(input: string): RecipeBodyDetectionResult {
  const trimmed = input.trim()

  if (looksLikeDecimalArray(trimmed)) {
    return { resolvedType: 'decimal-array', warnings: [] }
  }

  const hexLike = looksLikeHex(trimmed)
  const base64Like = looksLikeBase64(trimmed)

  if (hexLike) {
    const warnings: string[] = []
    if (/^[0-9A-Fa-f]+$/.test(trimmed)) {
      warnings.push('该输入同时符合纯 Hex 与普通文本特征，当前按 Hex 解析。')
    }
    if (base64Like) {
      warnings.push('该输入同时符合 Base64 特征，请确认解析方式是否正确。')
    }
    return { resolvedType: 'hex', warnings }
  }

  if (base64Like) {
    return {
      resolvedType: 'base64',
      warnings: ['该输入符合 Base64 特征，如解析结果异常，请手动切换输入类型。'],
    }
  }

  return { resolvedType: 'text', warnings: [] }
}

export function decodeRecipeBodyReadableString(bytes: Uint8Array, encoding: RecipeTextEncoding) {
  if (encoding === 'ascii') {
    return bytesToVisibleString(bytes)
  }

  try {
    const decoded = new TextDecoder(encoding, { fatal: false }).decode(bytes)
    return makeDecodedStringVisible(decoded)
  } catch {
    throw new Error(`${encoding.toUpperCase()} 解码失败，当前浏览器可能不支持该编码`)
  }
}

export function resolveRecipeBodyOutput(
  bytes: Uint8Array,
  preferredEncoding: RecipeTextEncoding,
  analysis: RecipeBodyBasicAnalysis,
): RecipeBodyOutputResult {
  if (analysis.magicMatches.some(match => ['ZIP', 'GZIP', 'ZLIB', 'TAR'].includes(match))) {
    return {
      mode: 'compressed',
      label: '压缩或归档数据',
      content: '',
      note: '检测到压缩或归档特征，当前不再自动转换为字符串。',
    }
  }

  if (preferredEncoding === 'utf-16le' || preferredEncoding === 'utf-16be') {
    return {
      mode: 'text-decoded',
      label: `${preferredEncoding.toUpperCase()} 文本`,
      content: decodeWithEncoding(bytes, preferredEncoding),
      note: `按手动指定的 ${preferredEncoding.toUpperCase()} 编码解码。`,
    }
  }

  const utf16Mode = detectUtf16Mode(bytes, analysis)
  if (utf16Mode) {
    return {
      mode: 'text-decoded',
      label: utf16Mode.label,
      content: decodeWithEncoding(bytes, utf16Mode.encoding),
      note: utf16Mode.note,
    }
  }

  if (shouldDecodeAsText(analysis)) {
    return {
      mode: 'text-decoded',
      label: `${preferredEncoding.toUpperCase()} 文本`,
      content: decodeRecipeBodyReadableString(bytes, preferredEncoding),
    }
  }

  return {
    mode: 'byte-escaped',
    label: '字节转义字符串',
    content: bytesToVisibleString(bytes),
    note: '检测到明显二进制特征，已自动切换为字节转义结果。',
  }
}

export function recommendRecipeBodyTextEncoding(
  bytes: Uint8Array,
  analysis: RecipeBodyBasicAnalysis,
  fallbackEncoding: RecipeTextEncoding,
): RecipeBodyTextEncodingRecommendation | null {
  if (!shouldDecodeAsText(analysis)) {
    return null
  }

  if (analysis.magicMatches.some(match => ['ZIP', 'GZIP', 'ZLIB', 'TAR'].includes(match))) {
    return null
  }

  if (detectUtf16Mode(bytes, analysis)) {
    return null
  }

  const utf16Candidate = detectUtf16Mode(bytes, analysis)
  if (utf16Candidate) {
    return {
      encoding: utf16Candidate.encoding,
      confidence: 0.98,
      note: `系统检测到 ${utf16Candidate.encoding.toUpperCase()} 特征。`,
    }
  }

  const candidates = (['utf-8', 'gbk', 'shift-jis', 'ascii'] as const)
    .map(encoding => scoreTextEncodingCandidate(bytes, encoding, analysis))
    .filter(candidate => candidate !== null)
    .sort((left, right) => right.score - left.score)

  if (!candidates.length) {
    return null
  }

  const best = candidates[0]
  if (!best) {
    return null
  }

  const second = candidates[1]
  const scoreGap = best.score - (second?.score ?? 0)
  const confidence = clampScore(best.score * 0.65 + scoreGap * 0.9)

  if (best.encoding !== fallbackEncoding && scoreGap < 0.08) {
    return {
      encoding: fallbackEncoding,
      confidence,
      note: `多种编码得分接近，暂时保留 ${fallbackEncoding.toUpperCase()}，仍可手动切换。`,
    }
  }

  return {
    encoding: best.encoding,
    confidence,
    note:
      best.encoding === fallbackEncoding
        ? `系统评估 ${best.encoding.toUpperCase()} 与当前内容最匹配。`
        : `系统根据解码评分自动推荐 ${best.encoding.toUpperCase()}，仍可手动切换。`,
  }
}

function parseByType(type: RecipeBodyResolvedInputType, input: string) {
  switch (type) {
    case 'hex':
      return parseHexString(input)
    case 'decimal-array':
      return parseDecimalArray(input)
    case 'base64':
      return parseBase64String(input)
    case 'text':
      return encodeTextInput(input)
    default:
      throw new Error(`暂不支持的输入类型: ${type}`)
  }
}

function parseHexString(input: string) {
  const normalized = input.replace(/0x/gi, '').replace(/[^a-fA-F0-9]/g, '')
  if (!normalized) {
    throw new Error('未识别到有效的 Hex 内容')
  }
  if (normalized.length % 2 !== 0) {
    throw new Error('Hex 字符数量必须为偶数')
  }

  const bytes = new Uint8Array(normalized.length / 2)
  for (let index = 0; index < bytes.length; index += 1) {
    const offset = index * 2
    const value = normalized.slice(offset, offset + 2)
    bytes[index] = Number.parseInt(value, 16)
  }

  return bytes
}

function parseDecimalArray(input: string) {
  const values = splitDecimalArrayValues(input)
  if (!values.length) {
    throw new Error('未识别到有效的十进制字节数组')
  }

  const bytes = new Uint8Array(values.length)
  values.forEach((value, index) => {
    const parsed = Number.parseInt(value, 10)
    if (!Number.isInteger(parsed) || parsed < -128 || parsed > 255) {
      throw new Error(`存在超出范围的字节值: ${value}`)
    }
    bytes[index] = parsed < 0 ? parsed + 256 : parsed
  })

  return bytes
}

function parseBase64String(input: string) {
  const normalized = input.replace(/\s+/g, '')
  if (!normalized) {
    throw new Error('未识别到有效的 Base64 内容')
  }

  try {
    const binary = atob(normalized)
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index)
    }
    return bytes
  } catch {
    throw new Error('Base64 解析失败，请确认输入内容是否完整')
  }
}

function encodeTextInput(input: string) {
  return new TextEncoder().encode(input)
}

function detectUtf16Mode(bytes: Uint8Array, analysis: RecipeBodyBasicAnalysis) {
  if (analysis.magicMatches.includes('UTF-16LE BOM')) {
    return {
      encoding: 'utf-16le' as const,
      label: 'UTF-16LE 文本',
      note: '检测到 UTF-16LE BOM，已自动按 UTF-16LE 解码。',
    }
  }

  if (analysis.magicMatches.includes('UTF-16BE BOM')) {
    return {
      encoding: 'utf-16be' as const,
      label: 'UTF-16BE 文本',
      note: '检测到 UTF-16BE BOM，已自动按 UTF-16BE 解码。',
    }
  }

  if (bytes.length < 4 || analysis.nullByteRatio < 0.2) {
    return null
  }

  let evenNulls = 0
  let oddNulls = 0
  for (let index = 0; index < bytes.length; index += 1) {
    if (bytes[index] !== 0x00) continue
    if (index % 2 === 0) {
      evenNulls += 1
    } else {
      oddNulls += 1
    }
  }

  const totalNulls = evenNulls + oddNulls
  if (!totalNulls) return null

  const evenRatio = evenNulls / totalNulls
  const oddRatio = oddNulls / totalNulls

  if (oddRatio >= 0.8 && analysis.printableAsciiRatio >= 0.15) {
    return {
      encoding: 'utf-16le' as const,
      label: 'UTF-16LE 文本',
      note: '检测到交替 NULL 分布，已自动按 UTF-16LE 解码。',
    }
  }

  if (evenRatio >= 0.8 && analysis.printableAsciiRatio >= 0.15) {
    return {
      encoding: 'utf-16be' as const,
      label: 'UTF-16BE 文本',
      note: '检测到交替 NULL 分布，已自动按 UTF-16BE 解码。',
    }
  }

  return null
}

function shouldDecodeAsText(analysis: RecipeBodyBasicAnalysis) {
  if (analysis.nullByteRatio >= 0.15) {
    return false
  }

  if (analysis.printableAsciiRatio >= 0.7) {
    return true
  }

  if (analysis.highByteRatio > 0 && analysis.controlCharRatio <= 0.1 && analysis.nullByteRatio <= 0.05) {
    return true
  }

  return false
}

function scoreTextEncodingCandidate(
  bytes: Uint8Array,
  encoding: RecipeTextEncoding,
  analysis: RecipeBodyBasicAnalysis,
) {
  const decoded = decodeRawByEncoding(bytes, encoding)
  if (decoded === null) {
    return null
  }

  const total = Math.max(Array.from(decoded).length, 1)
  let replacementCount = 0
  let controlCount = 0
  let nullCount = 0
  let asciiPrintableCount = 0
  let letterDigitCount = 0
  let punctuationSpaceCount = 0
  let hanCount = 0
  let kanaCount = 0
  let suspiciousCount = 0

  for (const character of decoded) {
    const codePoint = character.codePointAt(0)
    if (codePoint === undefined) continue

    if (character === '\uFFFD') {
      replacementCount += 1
      continue
    }

    if (codePoint === 0) {
      nullCount += 1
      continue
    }

    if ((codePoint >= 0x00 && codePoint <= 0x1f && !['\n', '\r', '\t'].includes(character)) || codePoint === 0x7f) {
      controlCount += 1
    }

    if (codePoint >= 0x20 && codePoint <= 0x7e) {
      asciiPrintableCount += 1
    }

    if (/[A-Za-z0-9]/.test(character)) {
      letterDigitCount += 1
    }

    if (/[\s.,;:!?()[\]{}<>"'`~@#$%^&*+=_|\\/，。！？、：；（）《》「」『』【】—…·￥ー・]/u.test(character)) {
      punctuationSpaceCount += 1
    }

    if ((codePoint >= 0x3400 && codePoint <= 0x4dbf) || (codePoint >= 0x4e00 && codePoint <= 0x9fff)) {
      hanCount += 1
    }

    if ((codePoint >= 0x3040 && codePoint <= 0x309f) || (codePoint >= 0x30a0 && codePoint <= 0x30ff)) {
      kanaCount += 1
    }

    if (/[ÃÂ¤Ð]/.test(character)) {
      suspiciousCount += 1
    }
  }

  const replacementRatio = replacementCount / total
  const controlRatio = controlCount / total
  const nullRatio = nullCount / total
  const asciiPrintableRatio = asciiPrintableCount / total
  const letterDigitRatio = letterDigitCount / total
  const punctuationSpaceRatio = punctuationSpaceCount / total
  const hanRatio = hanCount / total
  const kanaRatio = kanaCount / total
  const suspiciousRatio = suspiciousCount / total
  const visibleRatio = Math.max(0, 1 - replacementRatio - controlRatio - nullRatio)

  let score = 0
  score += visibleRatio * 0.34
  score += asciiPrintableRatio * 0.18
  score += (letterDigitRatio + punctuationSpaceRatio) * 0.14
  score += Math.max(hanRatio, kanaRatio) * 0.18
  score -= replacementRatio * 0.95
  score -= controlRatio * 0.7
  score -= nullRatio * 1.15
  score -= suspiciousRatio * 0.35

  if (encoding === 'utf-8' && analysis.highByteRatio === 0) {
    score += 0.05
  }

  if (encoding === 'ascii') {
    score -= 0.04
  }

  if (encoding === 'gbk') {
    score += hanRatio * 0.1
  }

  if (encoding === 'shift-jis') {
    score += kanaRatio * 0.18
  }

  return {
    encoding,
    score: clampScore(score),
  }
}

function decodeRawByEncoding(bytes: Uint8Array, encoding: RecipeTextEncoding) {
  if (encoding === 'ascii') {
    if (bytes.some(byte => byte > 0x7f)) {
      return null
    }

    return Array.from(bytes)
      .map(byte => String.fromCharCode(byte))
      .join('')
  }

  try {
    return new TextDecoder(encoding, { fatal: false }).decode(bytes)
  } catch {
    return null
  }
}

function clampScore(value: number) {
  return Math.max(0, Math.min(1, value))
}

function decodeWithEncoding(bytes: Uint8Array, encoding: 'utf-16le' | 'utf-16be') {
  try {
    return makeDecodedStringVisible(new TextDecoder(encoding, { fatal: false }).decode(bytes))
  } catch {
    throw new Error(`${encoding.toUpperCase()} 解码失败，当前浏览器可能不支持该编码`)
  }
}

function bytesToVisibleString(bytes: Uint8Array) {
  return Array.from(bytes)
    .map(byte => {
      if (byte === 0x0a) return '\n'
      if (byte === 0x0d) return '\r'
      if (byte === 0x09) return '\t'
      if (byte >= 0x20 && byte <= 0x7e) {
        return String.fromCharCode(byte)
      }
      return `\\x${byte.toString(16).toUpperCase().padStart(2, '0')}`
    })
    .join('')
}

function makeDecodedStringVisible(input: string) {
  return Array.from(input)
    .map(character => {
      const codePoint = character.codePointAt(0)
      if (codePoint === undefined) return ''
      if (character === '\n' || character === '\r' || character === '\t') {
        return character
      }
      if (codePoint === 0) {
        return '\\0'
      }
      if ((codePoint >= 0x01 && codePoint <= 0x1f) || codePoint === 0x7f) {
        return `\\x${codePoint.toString(16).toUpperCase().padStart(2, '0')}`
      }
      if (codePoint >= 0x80 && codePoint <= 0x9f) {
        return `\\u${codePoint.toString(16).toUpperCase().padStart(4, '0')}`
      }
      return character
    })
    .join('')
}

function looksLikeDecimalArray(input: string) {
  const normalized = input.trim()
  if (!normalized) return false

  const hasArrayMarkers = /^[[{(]/.test(normalized) || /[\]})]$/.test(normalized)
  const hasExplicitSeparators = /[,;，；\r\n\t ]/.test(normalized)
  if (!hasArrayMarkers && !hasExplicitSeparators) {
    return false
  }

  const values = splitDecimalArrayValues(normalized)
  if (values.length < 2) {
    return false
  }

  return values.every(value => {
    if (!/^-?\d+$/.test(value)) return false
    const parsed = Number.parseInt(value, 10)
    return Number.isInteger(parsed) && parsed >= -128 && parsed <= 255
  })
}

function splitDecimalArrayValues(input: string) {
  const stripped = input.trim().replace(/^[[{(]\s*/, '').replace(/\s*[\]})]$/, '')
  return stripped
    .split(/[\s,;，；]+/)
    .map(value => value.trim())
    .filter(Boolean)
}

function looksLikeHex(input: string) {
  const normalized = input.trim()
  if (!normalized) return false
  if (/^(0x[\da-fA-F]{2}(\s+|$))+$/i.test(normalized)) return true
  if (/^([\da-fA-F]{2}\s+)+[\da-fA-F]{2}$/i.test(normalized)) return true
  return /^[\da-fA-F]+$/i.test(normalized) && normalized.length % 2 === 0
}

function looksLikeBase64(input: string) {
  const normalized = input.replace(/\s+/g, '')
  if (!normalized || normalized.length % 4 !== 0) return false
  return /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(normalized)
}

function buildNormalizationResult(args: {
  rawBytes: Uint8Array
  sourceType: RecipeBodyResolvedInputType
  inputSize: number
  warnings: string[]
}): RecipeBodyNormalizationResult {
  return {
    rawBytes: args.rawBytes,
    sourceType: args.sourceType,
    inputSize: args.inputSize,
    bodyLength: args.rawBytes.length,
    warnings: args.warnings,
  }
}

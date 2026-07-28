export type RecipeBodyInputType = 'auto' | 'hex' | 'decimal-array' | 'base64'

export type RecipeBodyResolvedInputType = Exclude<RecipeBodyInputType, 'auto'> | 'text'

export type RecipeTextEncoding = 'ascii' | 'utf-8' | 'utf-16le' | 'utf-16be' | 'gbk' | 'shift-jis'

export interface RecipeBodyNormalizeOptions {
  inputType: RecipeBodyInputType
  text: string
}

export interface RecipeBodyDetectionResult {
  resolvedType: RecipeBodyResolvedInputType
  warnings: string[]
}

export interface RecipeBodyNormalizationResult {
  rawBytes: Uint8Array
  sourceType: RecipeBodyResolvedInputType
  inputSize: number
  bodyLength: number
  warnings: string[]
}

export interface RecipeBodyCandidateFormat {
  label: string
  confidence: number
  reason: string
}

export interface RecipeBodyNewlineStats {
  lf: number
  cr: number
  crlf: number
  mixed: boolean
}

export interface RecipeBodyBasicAnalysis {
  hashes: {
    md5: string
    sha1: string
    sha256: string
    sha512: string
  }
  entropy: number
  printableAsciiRatio: number
  controlCharRatio: number
  nullByteRatio: number
  highByteRatio: number
  tabCount: number
  newlineStats: RecipeBodyNewlineStats
  magicMatches: string[]
  candidateFormats: RecipeBodyCandidateFormat[]
  warnings: string[]
}

export type RecipeBodyOutputMode = 'compressed' | 'text-decoded' | 'byte-escaped'

export interface RecipeBodyOutputResult {
  mode: RecipeBodyOutputMode
  label: string
  content: string
  note?: string
}

export interface RecipeBodyTextEncodingRecommendation {
  encoding: RecipeTextEncoding
  confidence: number
  note: string
}

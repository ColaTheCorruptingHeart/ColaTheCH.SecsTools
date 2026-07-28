/// <reference lib="webworker" />

import { analyzeRecipeBodyBytes } from './recipe-body-analyzer/analysis'
import { normalizeRecipeBodyInput, recommendRecipeBodyTextEncoding, resolveRecipeBodyOutput } from './recipe-body-analyzer/input'
import type {
  RecipeBodyBasicAnalysis,
  RecipeBodyInputType,
  RecipeBodyNormalizationResult,
  RecipeBodyOutputResult,
  RecipeBodyTextEncodingRecommendation,
  RecipeTextEncoding,
} from './recipe-body-analyzer/types'

type AnalyzeWorkerRequest = {
  type: 'analyze'
  text: string
  inputType: RecipeBodyInputType
  preferredEncoding: RecipeTextEncoding
}

type OutputWorkerRequest = {
  type: 'resolve-output'
  rawBytes: Uint8Array
  analysis: RecipeBodyBasicAnalysis
  preferredEncoding: RecipeTextEncoding
}

type AnalyzeWorkerSuccessMessage = {
  type: 'analyze-success'
  normalized: RecipeBodyNormalizationResult
  analysis: RecipeBodyBasicAnalysis
  outputResult: RecipeBodyOutputResult
  encodingRecommendation: RecipeBodyTextEncodingRecommendation | null
  resolvedEncoding: RecipeTextEncoding
}

type OutputWorkerSuccessMessage = {
  type: 'output-success'
  outputResult: RecipeBodyOutputResult
}

type RecipeBodyWorkerErrorMessage = {
  type: 'error'
  message: string
}

type RecipeBodyWorkerRequest = AnalyzeWorkerRequest | OutputWorkerRequest
type RecipeBodyWorkerResponse = AnalyzeWorkerSuccessMessage | OutputWorkerSuccessMessage | RecipeBodyWorkerErrorMessage

const workerScope = self as DedicatedWorkerGlobalScope

workerScope.onmessage = async (event: MessageEvent<RecipeBodyWorkerRequest>) => {
  try {
    if (event.data.type === 'analyze') {
      const normalized = await normalizeRecipeBodyInput({
        inputType: event.data.inputType,
        text: event.data.text,
      })
      const nextAnalysis = await analyzeRecipeBodyBytes(normalized.rawBytes)
      const encodingRecommendation = recommendRecipeBodyTextEncoding(
        normalized.rawBytes,
        nextAnalysis,
        event.data.preferredEncoding,
      )
      const resolvedEncoding = encodingRecommendation?.encoding ?? event.data.preferredEncoding
      const outputResult = resolveRecipeBodyOutput(normalized.rawBytes, resolvedEncoding, nextAnalysis)

      const response: AnalyzeWorkerSuccessMessage = {
        type: 'analyze-success',
        normalized,
        analysis: nextAnalysis,
        outputResult,
        encodingRecommendation,
        resolvedEncoding,
      }

      workerScope.postMessage(response)
      return
    }

    const response: OutputWorkerSuccessMessage = {
      type: 'output-success',
      outputResult: resolveRecipeBodyOutput(event.data.rawBytes, event.data.preferredEncoding, event.data.analysis),
    }

    workerScope.postMessage(response)
  } catch (error) {
    const response: RecipeBodyWorkerErrorMessage = {
      type: 'error',
      message: error instanceof Error ? error.message : '解析失败，请检查输入内容',
    }

    workerScope.postMessage(response)
  }
}

export {}

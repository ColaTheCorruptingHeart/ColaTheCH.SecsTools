import { getNodeAtPath, getNodeValueText, type SecsSmlNode } from '../secs-log/sml'

export function cleanSecsValue(value: string) {
  return value
    .replace(/^['"]|['"]$/g, '')
    .trim()
}

const parsedPathCache = new Map<string, number[]>()
const parsedIgnorePathsCache = new WeakMap<string[], number[][]>()

export function parsePath(path: string) {
  const cached = parsedPathCache.get(path)
  if (cached) {
    return cached
  }

  const matches = Array.from(path.matchAll(/\[(\d+)\]/g))
  const parsedPath = matches.map(match => Number(match[1]))
  parsedPathCache.set(path, parsedPath)
  return parsedPath
}

function isSamePath(left: number[], right: number[]) {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function isAncestorPath(ancestor: number[], target: number[]) {
  return ancestor.length <= target.length && ancestor.every((value, index) => value === target[index])
}

export function isPathIgnored(path: string, ignorePaths: string[] = []) {
  const parsedPath = parsePath(path)
  return getParsedIgnorePaths(ignorePaths).some(ignorePath => isAncestorPath(ignorePath, parsedPath))
}

export function readNodeValueAtPath(roots: SecsSmlNode[], path: string) {
  const node = getNodeAtPath(roots, parsePath(path))
  return cleanSecsValue(getNodeValueText(node))
}

function serializeNode(node: SecsSmlNode, path: number[], ignoredPaths: number[][], depth: number): string[] {
  if (ignoredPaths.some(ignorePath => isSamePath(ignorePath, path) || isAncestorPath(ignorePath, path))) {
    return []
  }

  const indent = '  '.repeat(depth)
  const lines = [`${indent}${node.text}`]
  node.children.forEach((child, index) => {
    lines.push(...serializeNode(child, path.concat(index), ignoredPaths, depth + 1))
  })
  return lines
}

export function readNodeSubtreeAtPath(roots: SecsSmlNode[], path: string, ignorePaths: string[] = []) {
  const parsedPath = parsePath(path)
  const node = getNodeAtPath(roots, parsedPath)
  if (!node) {
    return ''
  }

  return serializeNode(node, parsedPath, getParsedIgnorePaths(ignorePaths), 0).join('\n').trim()
}

export function getChildrenAtPath(roots: SecsSmlNode[], path: string) {
  const node = getNodeAtPath(roots, parsePath(path))
  return node?.children || []
}

export function getNodeScalarValue(node: SecsSmlNode | undefined) {
  return cleanSecsValue(getNodeValueText(node))
}

function getParsedIgnorePaths(ignorePaths: string[]) {
  const cached = parsedIgnorePathsCache.get(ignorePaths)
  if (cached) {
    return cached
  }

  const parsedIgnorePaths = ignorePaths
    .map(ignorePath => parsePath(ignorePath))
    .filter(ignorePath => ignorePath.length > 0)
  parsedIgnorePathsCache.set(ignorePaths, parsedIgnorePaths)
  return parsedIgnorePaths
}

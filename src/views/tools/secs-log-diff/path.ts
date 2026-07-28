import { getNodeAtPath, getNodeValueText, type SecsSmlNode } from '../secs-log/sml'

export function cleanSecsValue(value: string) {
  return value
    .replace(/^['"]|['"]$/g, '')
    .trim()
}

export function parsePath(path: string) {
  const matches = Array.from(path.matchAll(/\[(\d+)\]/g))
  return matches.map(match => Number(match[1]))
}

function isSamePath(left: number[], right: number[]) {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function isAncestorPath(ancestor: number[], target: number[]) {
  return ancestor.length <= target.length && ancestor.every((value, index) => value === target[index])
}

export function isPathIgnored(path: string, ignorePaths: string[] = []) {
  const parsedPath = parsePath(path)
  return ignorePaths.some(ignorePath => {
    const parsedIgnorePath = parsePath(ignorePath)
    return parsedIgnorePath.length > 0 && isAncestorPath(parsedIgnorePath, parsedPath)
  })
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

  const parsedIgnoredPaths = ignorePaths
    .map(ignorePath => parsePath(ignorePath))
    .filter(ignorePath => ignorePath.length > 0)

  return serializeNode(node, parsedPath, parsedIgnoredPaths, 0).join('\n').trim()
}

export function getChildrenAtPath(roots: SecsSmlNode[], path: string) {
  const node = getNodeAtPath(roots, parsePath(path))
  return node?.children || []
}

export function getNodeScalarValue(node: SecsSmlNode | undefined) {
  return cleanSecsValue(getNodeValueText(node))
}

import { parseSmlTree, type SecsSmlNode } from '../secs-log/sml'
import { evaluateAck } from './ack'
import {
  cleanSecsValue,
  getChildrenAtPath,
  getNodeScalarValue,
  isPathIgnored,
  readNodeSubtreeAtPath,
  readNodeValueAtPath
} from './path'
import { findMessageDiffRule } from './rules'
import type {
  MessageDiffRule,
  SecsLogDiffProfile,
  SecsLogEventType,
  SecsLogMessage,
  SecsSemanticEvent
} from './types'

function createParseErrorEvent(message: SecsLogMessage, parseError: string, rule?: MessageDiffRule): SecsSemanticEvent {
  return {
    id: `event-${message.id}`,
    messageId: message.id,
    index: message.index,
    sf: message.sf || 'UNKNOWN',
    time: message.time,
    timeMs: message.timeMs,
    type: 'parse_error',
    key: message.sf || 'UNKNOWN',
    summary: message.sf ? `${message.sf} parse error` : 'Unknown message parse error',
    attributes: {},
    rawText: message.rawText,
    parseError,
    ruleId: rule?.id,
    ruleSeverity: rule?.severity,
    diffMode: rule?.mode || 'presence'
  }
}

function getEventType(message: SecsLogMessage, rule: MessageDiffRule): SecsLogEventType {
  if (rule.extractor === 'S2F41') return 'remote_command'
  if (rule.extractor === 'S2F42') return 'remote_command_ack'
  if (rule.extractor === 'S6F11') return 'event_report'
  if (rule.extractor === 'S6F12') return 'event_ack'
  if (rule.extractor === 'S5F1') return 'alarm_report'
  if (rule.extractor === 'S5F2') return 'alarm_ack'
  if (message.sf === 'S2F41') return 'remote_command'
  if (message.sf === 'S2F42') return 'remote_command_ack'
  if (message.sf === 'S6F11') return 'event_report'
  if (message.sf === 'S6F12') return 'event_ack'
  if (message.sf === 'S5F1') return 'alarm_report'
  if (message.sf === 'S5F2') return 'alarm_ack'
  return 'generic'
}

function readPathRuleValue(roots: SecsSmlNode[], rule: MessageDiffRule, pathRule: MessageDiffRule['fieldPaths'][number]) {
  if (pathRule.valueMode === 'subtree') {
    return readNodeSubtreeAtPath(roots, pathRule.path, rule.ignorePaths)
  }

  return readNodeValueAtPath(roots, pathRule.path)
}

function addPathAttribute(
  attributes: Record<string, string>,
  roots: SecsSmlNode[],
  rule: MessageDiffRule,
  pathRule: MessageDiffRule['fieldPaths'][number],
  forceCompare: boolean
) {
  if (isPathIgnored(pathRule.path, rule.ignorePaths)) {
    return
  }

  if (pathRule.compare === false && !forceCompare) {
    return
  }

  if (attributes[pathRule.label]) {
    return
  }

  const value = readPathRuleValue(roots, rule, pathRule)
  if (value || pathRule.required || pathRule.compare !== false || forceCompare) {
    attributes[pathRule.label] = value
  }
}

function addPathAttributes(attributes: Record<string, string>, roots: SecsSmlNode[], rule: MessageDiffRule) {
  rule.keyPaths.forEach(pathRule => {
    addPathAttribute(attributes, roots, rule, pathRule, true)
  })

  rule.fieldPaths.forEach(pathRule => {
    addPathAttribute(attributes, roots, rule, pathRule, false)
  })
}

function buildKey(message: SecsLogMessage, rule: MessageDiffRule, attributes: Record<string, string>) {
  if (rule.mode === 'presence') {
    return message.sf
  }

  const keyParts = rule.keyPaths
    .map(pathRule => {
      const value = attributes[pathRule.label] || ''
      return value ? `${pathRule.label}=${value}` : ''
    })
    .filter(Boolean)

  if (keyParts.length) {
    return `${message.sf}:${keyParts.join(':')}`
  }

  return message.sf
}

function canAddExtractorAttribute(rule: MessageDiffRule, path: string, label: string) {
  if (isPathIgnored(path, rule.ignorePaths)) {
    return false
  }

  return !rule.fieldPaths.some(pathRule => {
    return pathRule.compare === false && (pathRule.path === path || pathRule.label === label)
  })
}

function setExtractorAttribute(attributes: Record<string, string>, rule: MessageDiffRule, path: string, label: string, value: string) {
  if (!value || !canAddExtractorAttribute(rule, path, label)) {
    return
  }

  attributes[label] = value
}

function addExtractorChildAttribute(
  attributes: Record<string, string>,
  rule: MessageDiffRule,
  path: string,
  label: string,
  value: string
) {
  if (!canAddExtractorAttribute(rule, path, label)) {
    return
  }

  if (value) {
    attributes[label] = value
  }
}

function addS2F41Attributes(attributes: Record<string, string>, roots: SecsSmlNode[], rule: MessageDiffRule) {
  const rcmd = readNodeValueAtPath(roots, '[0][0]')
  setExtractorAttribute(attributes, rule, '[0][0]', 'RCMD', rcmd)

  getChildrenAtPath(roots, '[0][1]').forEach((pairNode, index) => {
    const namePath = `[0][1][${index}][0]`
    const valuePath = `[0][1][${index}][1]`
    if (isPathIgnored(`[0][1][${index}]`, rule.ignorePaths)) {
      return
    }

    const name = getNodeScalarValue(pairNode.children[0])
    const value = getNodeScalarValue(pairNode.children[1])
    if (name) {
      addExtractorChildAttribute(attributes, rule, valuePath, `CP.${name}`, value)
    } else if (value) {
      addExtractorChildAttribute(attributes, rule, namePath, `CP[${index}]`, value)
    }
  })
}

function addS2F42Attributes(attributes: Record<string, string>, roots: SecsSmlNode[], rule: MessageDiffRule) {
  const hcack = readNodeValueAtPath(roots, '[0][0]')
  setExtractorAttribute(attributes, rule, '[0][0]', 'HCACK', hcack)

  getChildrenAtPath(roots, '[0][1]').forEach((pairNode, index) => {
    const namePath = `[0][1][${index}][0]`
    const valuePath = `[0][1][${index}][1]`
    if (isPathIgnored(`[0][1][${index}]`, rule.ignorePaths)) {
      return
    }

    const name = getNodeScalarValue(pairNode.children[0])
    const value = getNodeScalarValue(pairNode.children[1])
    if (name) {
      addExtractorChildAttribute(attributes, rule, valuePath, `CPACK.${name}`, value)
    } else if (value) {
      addExtractorChildAttribute(attributes, rule, namePath, `CPACK[${index}]`, value)
    }
  })
}

function addS6F11Attributes(attributes: Record<string, string>, roots: SecsSmlNode[], rule: MessageDiffRule) {
  const dataId = readNodeValueAtPath(roots, '[0][0]')
  const ceid = readNodeValueAtPath(roots, '[0][1]')
  setExtractorAttribute(attributes, rule, '[0][0]', 'DATAID', dataId)
  setExtractorAttribute(attributes, rule, '[0][1]', 'CEID', ceid)

  getChildrenAtPath(roots, '[0][2]').forEach((reportNode, reportIndex) => {
    const reportPath = `[0][2][${reportIndex}]`
    if (isPathIgnored(reportPath, rule.ignorePaths)) {
      return
    }

    const rptidPath = `${reportPath}[0]`
    const rptid = getNodeScalarValue(reportNode.children[0]) || String(reportIndex)
    if (rptid) {
      addExtractorChildAttribute(attributes, rule, rptidPath, `RPT[${reportIndex}].RPTID`, rptid)
    }

    const valueList = reportNode.children[1]?.children || []
    valueList.forEach((valueNode, valueIndex) => {
      const valuePath = `${reportPath}[1][${valueIndex}]`
      const value = getNodeScalarValue(valueNode)
      addExtractorChildAttribute(attributes, rule, valuePath, `RPT.${rptid}.value[${valueIndex}]`, value)
    })
  })
}

function addS6F12Attributes(attributes: Record<string, string>, roots: SecsSmlNode[], rule: MessageDiffRule) {
  const ackc6 = readNodeValueAtPath(roots, '[0]')
  setExtractorAttribute(attributes, rule, '[0]', 'ACKC6', ackc6)
}

function addS5F1Attributes(attributes: Record<string, string>, roots: SecsSmlNode[], rule: MessageDiffRule) {
  const alcd = readNodeValueAtPath(roots, '[0][0]')
  const alid = readNodeValueAtPath(roots, '[0][1]')
  const altx = readNodeValueAtPath(roots, '[0][2]')
  setExtractorAttribute(attributes, rule, '[0][0]', 'ALCD', alcd)
  setExtractorAttribute(attributes, rule, '[0][1]', 'ALID', alid)
  setExtractorAttribute(attributes, rule, '[0][2]', 'ALTX', altx)
}

function addS5F2Attributes(attributes: Record<string, string>, roots: SecsSmlNode[], rule: MessageDiffRule) {
  const ackc5 = readNodeValueAtPath(roots, '[0]')
  setExtractorAttribute(attributes, rule, '[0]', 'ACKC5', ackc5)
}

function addExtractorAttributes(attributes: Record<string, string>, roots: SecsSmlNode[], rule: MessageDiffRule) {
  if (rule.extractor === 'S2F41') addS2F41Attributes(attributes, roots, rule)
  if (rule.extractor === 'S2F42') addS2F42Attributes(attributes, roots, rule)
  if (rule.extractor === 'S6F11') addS6F11Attributes(attributes, roots, rule)
  if (rule.extractor === 'S6F12') addS6F12Attributes(attributes, roots, rule)
  if (rule.extractor === 'S5F1') addS5F1Attributes(attributes, roots, rule)
  if (rule.extractor === 'S5F2') addS5F2Attributes(attributes, roots, rule)
}

function makeSummary(message: SecsLogMessage, rule: MessageDiffRule, attributes: Record<string, string>) {
  if (attributes.RCMD) return `${message.sf} ${attributes.RCMD}`
  if (attributes.CEID) return `${message.sf} CEID=${attributes.CEID}`
  if (attributes.ALID) return `${message.sf} ALID=${attributes.ALID}`
  if (attributes.HCACK) return `${message.sf} HCACK=${attributes.HCACK}`
  if (attributes.ACKC6) return `${message.sf} ACKC6=${attributes.ACKC6}`
  if (attributes.ACKC5) return `${message.sf} ACKC5=${attributes.ACKC5}`
  return rule.desc ? `${message.sf} ${rule.desc}` : message.sf
}

export function buildSemanticEvent(message: SecsLogMessage, profile: SecsLogDiffProfile): SecsSemanticEvent | null {
  if (message.parseError) {
    return createParseErrorEvent(message, message.parseError)
  }

  const rule = findMessageDiffRule(profile, message.sf)
  if (rule?.mode === 'ignore') {
    return null
  }

  const activeRule: MessageDiffRule = rule || {
    id: `fallback-${message.sf}`,
    enabled: true,
    sf: message.sf,
    mode: 'key-only',
    keyPaths: [],
    fieldPaths: []
  }

  if (activeRule.mode === 'presence' || activeRule.mode === 'key-only') {
    return {
      id: `event-${message.id}`,
      messageId: message.id,
      index: message.index,
      sf: message.sf,
      time: message.time,
      timeMs: message.timeMs,
      type: getEventType(message, activeRule),
      key: message.sf,
      summary: activeRule.desc ? `${message.sf} ${activeRule.desc}` : message.sf,
      attributes: {},
      rawText: message.rawText,
      ruleId: activeRule.id,
      ruleSeverity: activeRule.severity,
      diffMode: activeRule.mode
    }
  }

  try {
    const parsed = parseSmlTree(message.rawText)
    const attributes: Record<string, string> = {}
    addExtractorAttributes(attributes, parsed.roots, activeRule)
    addPathAttributes(attributes, parsed.roots, activeRule)

    for (const pathRule of activeRule.keyPaths) {
      if (pathRule.required && !attributes[pathRule.label]) {
        return createParseErrorEvent(message, `Missing required key ${pathRule.label}`, activeRule)
      }
    }

    const ackValue = activeRule.ackRule ? readNodeValueAtPath(parsed.roots, activeRule.ackRule.path) : ''

    return {
      id: `event-${message.id}`,
      messageId: message.id,
      index: message.index,
      sf: message.sf,
      time: message.time,
      timeMs: message.timeMs,
      type: getEventType(message, activeRule),
      key: buildKey(message, activeRule, attributes),
      summary: makeSummary(message, activeRule, attributes),
      attributes: Object.fromEntries(
        Object.entries(attributes).map(([key, value]) => [key, cleanSecsValue(value)])
      ),
      rawText: message.rawText,
      ruleId: activeRule.id,
      ruleSeverity: activeRule.severity,
      diffMode: activeRule.mode,
      ack: activeRule.ackRule && ackValue ? evaluateAck(activeRule.ackRule, ackValue) : undefined
    }
  } catch (error: unknown) {
    return createParseErrorEvent(message, error instanceof Error ? error.message : 'SML parse failed', activeRule)
  }
}

export function buildSemanticEvents(messages: SecsLogMessage[], profile: SecsLogDiffProfile) {
  return messages
    .map(message => buildSemanticEvent(message, profile))
    .filter((event): event is SecsSemanticEvent => Boolean(event))
}

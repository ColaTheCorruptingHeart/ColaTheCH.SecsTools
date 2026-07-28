import type { MessageDiffRule, SecsLogDiffProfile } from './types'

export const DEFAULT_SECS_LOG_DIFF_PROFILE: SecsLogDiffProfile = {
  id: 'default-gem',
  name: 'Default GEM profile',
  rules: [
    {
      id: 'ignore-linktest-s1f1',
      enabled: true,
      sf: 'S1F1',
      mode: 'ignore',
      keyPaths: [],
      fieldPaths: [],
      desc: 'Ignore linktest request'
    },
    {
      id: 'ignore-linktest-s1f2',
      enabled: true,
      sf: 'S1F2',
      mode: 'ignore',
      keyPaths: [],
      fieldPaths: [],
      desc: 'Ignore linktest reply'
    },
    {
      id: 's2f41-remote-command',
      enabled: true,
      sf: 'S2F41',
      mode: 'field',
      extractor: 'S2F41',
      keyPaths: [{ id: 'rcmd', label: 'RCMD', path: '[0][0]', required: true }],
      fieldPaths: [{ id: 'rcmd-field', label: 'RCMD', path: '[0][0]', compare: true }],
      desc: 'Host command'
    },
    {
      id: 's2f42-remote-command-ack',
      enabled: true,
      sf: 'S2F42',
      mode: 'field',
      extractor: 'S2F42',
      keyPaths: [],
      fieldPaths: [{ id: 'hcack-field', label: 'HCACK', path: '[0][0]', compare: true }],
      ackRule: {
        field: 'HCACK',
        path: '[0][0]',
        successValues: ['0'],
        severity: 'critical'
      },
      desc: 'Host command acknowledge'
    },
    {
      id: 's6f11-event-report',
      enabled: true,
      sf: 'S6F11',
      mode: 'field',
      keyPaths: [{ id: 'ceid', label: 'CEID', path: '[0][1]', required: true }],
      fieldPaths: [
        { id: 'body-subtree', label: 'Body', path: '[0][2]', valueMode: 'subtree', compare: true }
      ],
      ignorePaths: ['[0][0]'],
      desc: 'Event report'
    },
    {
      id: 's6f12-event-ack',
      enabled: true,
      sf: 'S6F12',
      mode: 'field',
      extractor: 'S6F12',
      keyPaths: [],
      fieldPaths: [{ id: 'ackc6-field', label: 'ACKC6', path: '[0]', compare: true }],
      ackRule: {
        field: 'ACKC6',
        path: '[0]',
        successValues: ['0'],
        severity: 'major'
      },
      desc: 'Event acknowledge'
    },
    {
      id: 's5f1-alarm-report',
      enabled: true,
      sf: 'S5F1',
      mode: 'field',
      extractor: 'S5F1',
      keyPaths: [{ id: 'alid', label: 'ALID', path: '[0][1]', required: true }],
      fieldPaths: [
        { id: 'alcd-field', label: 'ALCD', path: '[0][0]', compare: true },
        { id: 'alid-field', label: 'ALID', path: '[0][1]', compare: true },
        { id: 'altx-field', label: 'ALTX', path: '[0][2]', compare: true }
      ],
      desc: 'Alarm report',
      severity: {
        added: 'critical'
      }
    },
    {
      id: 's5f2-alarm-ack',
      enabled: true,
      sf: 'S5F2',
      mode: 'field',
      extractor: 'S5F2',
      keyPaths: [],
      fieldPaths: [{ id: 'ackc5-field', label: 'ACKC5', path: '[0]', compare: true }],
      ackRule: {
        field: 'ACKC5',
        path: '[0]',
        successValues: ['0'],
        severity: 'major'
      },
      desc: 'Alarm acknowledge'
    },
    {
      id: 's9-series-presence',
      enabled: true,
      sf: 'S9*',
      mode: 'presence',
      keyPaths: [],
      fieldPaths: [],
      desc: 'SECS error messages',
      severity: {
        added: 'major',
        missing: 'major'
      }
    }
  ]
}

export function cloneDefaultProfile(): SecsLogDiffProfile {
  return JSON.parse(JSON.stringify(DEFAULT_SECS_LOG_DIFF_PROFILE)) as SecsLogDiffProfile
}

function matchSfPattern(pattern: string, sf: string) {
  if (pattern.endsWith('*')) {
    return sf.startsWith(pattern.slice(0, -1))
  }

  return pattern === sf
}

export function findMessageDiffRule(profile: SecsLogDiffProfile, sf: string): MessageDiffRule | null {
  const enabledRules = profile.rules.filter(rule => rule.enabled !== false)
  return enabledRules.find(rule => matchSfPattern(rule.sf.toUpperCase(), sf.toUpperCase())) || null
}

export function normalizeProfile(input: unknown): SecsLogDiffProfile {
  const data = input as Partial<SecsLogDiffProfile>
  if (!data || typeof data !== 'object' || !Array.isArray(data.rules)) {
    throw new Error('规则文件格式无效')
  }

  const normalizedRules = data.rules
    .filter(rule => rule && typeof rule === 'object')
    .map(rule => {
      const rawRule = rule as Partial<MessageDiffRule>
      if (!rawRule.sf || !rawRule.mode) {
        throw new Error('规则缺少 sf 或 mode')
      }

      return {
        id: rawRule.id || `${rawRule.sf}-${rawRule.mode}`,
        enabled: rawRule.enabled !== false,
        sf: rawRule.sf.toUpperCase(),
        mode: rawRule.mode,
        keyPaths: Array.isArray(rawRule.keyPaths) ? rawRule.keyPaths : [],
        fieldPaths: Array.isArray(rawRule.fieldPaths) ? rawRule.fieldPaths : [],
        ignorePaths: Array.isArray(rawRule.ignorePaths) ? rawRule.ignorePaths : [],
        ackRule: rawRule.ackRule,
        desc: rawRule.desc || '',
        severity: rawRule.severity || {},
        extractor: rawRule.extractor
      } satisfies MessageDiffRule
    })

  return {
    id: data.id || `profile-${Date.now()}`,
    name: data.name || 'Custom profile',
    rules: normalizedRules
  }
}

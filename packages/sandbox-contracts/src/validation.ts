import type { CheckerStatus, SandboxPhase, ValidationIssue } from './types'

const checkerStatuses: CheckerStatus[] = ['passed', 'failed', 'error', 'timeout']
const sandboxPhases: SandboxPhase[] = [
  'pending',
  'provisioning',
  'ready',
  'running',
  'submitted',
  'checking',
  'passed',
  'failed',
  'error',
  'expired',
  'resetting',
  'destroying',
  'destroyed',
]

type RecordValue = Record<string, unknown>

const isRecord = (value: unknown): value is RecordValue => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0
const isPositiveInteger = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value > 0
const isNonNegativeNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0
const isDateString = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value))

const issue = (path: string, message: string): ValidationIssue => ({ path, message })

export class SandboxValidationError extends Error {
  constructor(public readonly issues: ValidationIssue[]) {
    super('sandbox 数据校验失败')
    this.name = 'SandboxValidationError'
  }
}

export const validateSandboxSpec = (value: unknown): ValidationIssue[] => {
  const issues: ValidationIssue[] = []
  if (!isRecord(value)) return [issue('$', '必须是对象')]

  if (value.schemaVersion !== 'sandbox.v1') issues.push(issue('schemaVersion', '必须为 sandbox.v1'))
  for (const key of ['id', 'version', 'profileRef', 'checkerRef']) {
    if (!isNonEmptyString(value[key])) issues.push(issue(key, '不能为空'))
  }

  const terminal = value.terminal
  if (!isRecord(terminal)) {
    issues.push(issue('terminal', '必须是对象'))
  } else {
    if (typeof terminal.enabled !== 'boolean') issues.push(issue('terminal.enabled', '必须是布尔值'))
    if (!isNonEmptyString(terminal.shell)) issues.push(issue('terminal.shell', '不能为空'))
  }

  const network = value.network
  if (!isRecord(network)) {
    issues.push(issue('network', '必须是对象'))
  } else if (network.mode !== 'none') {
    issues.push(issue('network.mode', '第一阶段只允许 none'))
  }

  const workspace = value.workspace
  if (!isRecord(workspace)) {
    issues.push(issue('workspace', '必须是对象'))
  } else {
    if (!isNonEmptyString(workspace.seedRef)) issues.push(issue('workspace.seedRef', '不能为空'))
    if (!isNonEmptyString(workspace.writablePath)) {
      issues.push(issue('workspace.writablePath', '不能为空'))
    } else if (!workspace.writablePath.startsWith('/')) {
      issues.push(issue('workspace.writablePath', '必须是绝对路径'))
    }
    if (!isPositiveInteger(workspace.maxSizeMiB)) issues.push(issue('workspace.maxSizeMiB', '必须是正整数'))
  }

  const lifecycle = value.lifecycle
  if (!isRecord(lifecycle)) {
    issues.push(issue('lifecycle', '必须是对象'))
  } else {
    if (!isPositiveInteger(lifecycle.maxLifetimeSeconds)) issues.push(issue('lifecycle.maxLifetimeSeconds', '必须是正整数'))
    if (!isPositiveInteger(lifecycle.idleTimeoutSeconds)) issues.push(issue('lifecycle.idleTimeoutSeconds', '必须是正整数'))
    if (isPositiveInteger(lifecycle.maxLifetimeSeconds) && isPositiveInteger(lifecycle.idleTimeoutSeconds) && lifecycle.idleTimeoutSeconds > lifecycle.maxLifetimeSeconds) {
      issues.push(issue('lifecycle.idleTimeoutSeconds', '不能大于 maxLifetimeSeconds'))
    }
    if (lifecycle.retryPolicy !== 'recreate') issues.push(issue('lifecycle.retryPolicy', '第一阶段只允许 recreate'))
  }

  return issues
}

export const validateSandboxSession = (value: unknown): ValidationIssue[] => {
  const issues: ValidationIssue[] = []
  if (!isRecord(value)) return [issue('$', '必须是对象')]

  if (value.schemaVersion !== 'session.v1') issues.push(issue('schemaVersion', '必须为 session.v1'))
  for (const key of ['id', 'nodeRef', 'mapRef']) {
    if (!isNonEmptyString(value[key])) issues.push(issue(key, '不能为空'))
  }
  if (!isPositiveInteger(value.attempt)) issues.push(issue('attempt', '必须是正整数'))
  if (!sandboxPhases.includes(value.phase as SandboxPhase)) issues.push(issue('phase', '不是受支持的值'))
  for (const key of ['createdAt', 'expiresAt', 'lastActivityAt']) {
    if (!isDateString(value[key])) issues.push(issue(key, '必须是有效时间'))
  }
  if (isDateString(value.createdAt) && isDateString(value.expiresAt) && Date.parse(value.expiresAt) <= Date.parse(value.createdAt)) {
    issues.push(issue('expiresAt', '必须晚于 createdAt'))
  }

  const terminal = value.terminal
  if (!isRecord(terminal)) {
    issues.push(issue('terminal', '必须是对象'))
  } else {
    if (terminal.protocol !== 'pty-v1') issues.push(issue('terminal.protocol', '第一阶段只允许 pty-v1'))
    if (typeof terminal.attachable !== 'boolean') issues.push(issue('terminal.attachable', '必须是布尔值'))
  }

  return issues
}

export const validateCheckerResult = (value: unknown): ValidationIssue[] => {
  const issues: ValidationIssue[] = []
  if (!isRecord(value)) return [issue('$', '必须是对象')]

  if (value.schemaVersion !== 'checker-result.v1') issues.push(issue('schemaVersion', '必须为 checker-result.v1'))
  if (!isNonEmptyString(value.sessionId)) issues.push(issue('sessionId', '不能为空'))
  if (!checkerStatuses.includes(value.status as CheckerStatus)) issues.push(issue('status', 'status 不是受支持的值'))
  if (!isNonEmptyString(value.checkerVersion)) issues.push(issue('checkerVersion', '不能为空'))
  if (!Array.isArray(value.feedback)) issues.push(issue('feedback', '必须是数组'))
  if (!isRecord(value.metrics)) issues.push(issue('metrics', '必须是对象'))
  if (!Array.isArray(value.artifacts)) issues.push(issue('artifacts', '必须是数组'))

  if (value.score !== undefined) {
    if (!isRecord(value.score)) {
      issues.push(issue('score', '必须是对象'))
    } else {
      if (!isNonNegativeNumber(value.score.value)) issues.push(issue('score.value', '必须是非负数'))
      if (!isPositiveInteger(value.score.max)) issues.push(issue('score.max', '必须是正整数'))
      if (isNonNegativeNumber(value.score.value) && isPositiveInteger(value.score.max) && value.score.value > value.score.max) {
        issues.push(issue('score.value', '必须位于 0 和 score.max 之间'))
      }
    }
  }

  if (Array.isArray(value.feedback)) {
    value.feedback.forEach((feedback, index) => {
      if (!isRecord(feedback)) {
        issues.push(issue(`feedback[${index}]`, '必须是对象'))
        return
      }
      if (!isNonEmptyString(feedback.code)) issues.push(issue(`feedback[${index}].code`, '不能为空'))
      if (!isNonEmptyString(feedback.message)) issues.push(issue(`feedback[${index}].message`, '不能为空'))
      if (feedback.visibility !== 'participant' && feedback.visibility !== 'organizer') {
        issues.push(issue(`feedback[${index}].visibility`, '必须为 participant 或 organizer'))
      }
    })
  }

  if (isRecord(value.metrics)) {
    Object.entries(value.metrics).forEach(([key, metric]) => {
      if (!isNonNegativeNumber(metric)) issues.push(issue(`metrics.${key}`, '必须是非负数'))
    })
  }

  if (Array.isArray(value.artifacts)) {
    value.artifacts.forEach((artifact, index) => {
      if (!isRecord(artifact)) {
        issues.push(issue(`artifacts[${index}]`, '必须是对象'))
        return
      }
      for (const key of ['id', 'name', 'mediaType']) {
        if (!isNonEmptyString(artifact[key])) issues.push(issue(`artifacts[${index}].${key}`, '不能为空'))
      }
      if (!isNonNegativeNumber(artifact.sizeBytes)) issues.push(issue(`artifacts[${index}].sizeBytes`, '必须是非负数'))
    })
  }

  return issues
}

import { describe, expect, it } from 'vitest'
import { validateCheckerResult, validateSandboxSession, validateSandboxSpec } from './validation'

const validSpec = () => ({
  schemaVersion: 'sandbox.v1',
  id: 'node-example',
  version: '1.0.0',
  profileRef: 'basic-linux@1',
  terminal: { enabled: true, shell: '/bin/bash' },
  network: { mode: 'none' },
  workspace: { seedRef: 'seed/', writablePath: '/workspace', maxSizeMiB: 1024 },
  lifecycle: { maxLifetimeSeconds: 1800, idleTimeoutSeconds: 600, retryPolicy: 'recreate' },
  checkerRef: 'checker/node-example@1',
})

const validSession = () => ({
  schemaVersion: 'session.v1',
  id: 'attempt-1',
  nodeRef: 'node-example@1.0.0',
  mapRef: 'recruitment-map@1',
  attempt: 1,
  phase: 'running',
  createdAt: '2026-09-10T12:00:00.000Z',
  expiresAt: '2026-09-10T12:30:00.000Z',
  lastActivityAt: '2026-09-10T12:08:00.000Z',
  terminal: { protocol: 'pty-v1', attachable: true },
})

const validResult = () => ({
  schemaVersion: 'checker-result.v1',
  sessionId: 'attempt-1',
  status: 'passed',
  score: { value: 80, max: 100 },
  feedback: [{ code: 'BRANCH_CREATED', message: '本地分支结构正确', visibility: 'participant' }],
  metrics: { commands: 3 },
  artifacts: [{ id: 'artifact-1', name: 'result.txt', mediaType: 'text/plain', sizeBytes: 12 }],
  checkerVersion: 'checker@1',
})

describe('sandbox schema validation', () => {
  it('accepts an offline interactive SandboxSpec', () => {
    expect(validateSandboxSpec(validSpec())).toEqual([])
  })

  it('rejects network modes other than none', () => {
    const issues = validateSandboxSpec({ ...validSpec(), network: { mode: 'egress' } })
    expect(issues).toContainEqual({ path: 'network.mode', message: '第一阶段只允许 none' })
  })

  it('rejects an idle timeout larger than the maximum lifetime', () => {
    const issues = validateSandboxSpec({
      ...validSpec(),
      lifecycle: { ...validSpec().lifecycle, maxLifetimeSeconds: 60, idleTimeoutSeconds: 61 },
    })
    expect(issues).toContainEqual({ path: 'lifecycle.idleTimeoutSeconds', message: '不能大于 maxLifetimeSeconds' })
  })

  it('rejects a relative workspace path', () => {
    const issues = validateSandboxSpec({
      ...validSpec(),
      workspace: { ...validSpec().workspace, writablePath: 'workspace' },
    })
    expect(issues).toContainEqual({ path: 'workspace.writablePath', message: '必须是绝对路径' })
  })

  it('validates a running SandboxSession', () => {
    expect(validateSandboxSession(validSession())).toEqual([])
  })

  it('validates CheckerResult status and score bounds', () => {
    expect(validateCheckerResult(validResult())).toEqual([])
    expect(validateCheckerResult({ ...validResult(), status: 'unknown' })).toContainEqual({
      path: 'status',
      message: 'status 不是受支持的值',
    })
    expect(validateCheckerResult({ ...validResult(), score: { value: 120, max: 100 } })).toContainEqual({
      path: 'score.value',
      message: '必须位于 0 和 score.max 之间',
    })
  })
})

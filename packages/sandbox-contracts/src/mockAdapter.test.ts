import { describe, expect, it } from 'vitest'
import { MockSandboxAdapter } from './mockAdapter'
import type { AttemptContext, CheckerResult, SandboxSpec } from './types'

const validSpec = (): SandboxSpec => ({
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

const context = (attempt = 1): AttemptContext => ({
  nodeRef: 'node-example@1.0.0',
  mapRef: 'recruitment-map@1',
  attempt,
  participantRef: 'participant-1',
})

const ids = () => {
  let index = 0
  return () => `session-${++index}`
}

const resultFor = (sessionId: string, status: CheckerResult['status'] = 'passed'): CheckerResult => ({
  schemaVersion: 'checker-result.v1',
  sessionId,
  status,
  score: status === 'passed' ? { value: 100, max: 100 } : undefined,
  feedback: [],
  metrics: {},
  artifacts: [],
  checkerVersion: 'checker@1',
})

describe('MockSandboxAdapter', () => {
  it('provisions a ready session and attaches an interactive terminal', async () => {
    const adapter = new MockSandboxAdapter({ now: () => '2026-09-10T12:00:00.000Z', idFactory: ids() })
    const session = await adapter.provision(validSpec(), context())

    expect(session.phase).toBe('ready')
    expect(session.attempt).toBe(1)

    const terminal = await adapter.attachTerminal(session.id)

    expect(terminal.protocol).toBe('pty-v1')
    expect(terminal.sessionId).toBe(session.id)
    expect(terminal.token).toContain(session.id)
    expect(adapter.getSession(session.id)?.phase).toBe('running')
  })

  it('freezes and checks a submitted session', async () => {
    const now = () => '2026-09-10T12:00:00.000Z'
    const adapter = new MockSandboxAdapter({
      checker: (session) => resultFor(session.id),
      now,
      idFactory: ids(),
    })
    const session = await adapter.provision(validSpec(), context())
    await adapter.attachTerminal(session.id)

    const result = await adapter.submit(session.id)

    expect(result.status).toBe('passed')
    expect(adapter.getSession(session.id)?.phase).toBe('passed')
    await expect(adapter.attachTerminal(session.id)).rejects.toThrow('不允许')
  })

  it('maps checker timeout to an expired session', async () => {
    const adapter = new MockSandboxAdapter({
      checker: (session) => resultFor(session.id, 'timeout'),
      now: () => '2026-09-10T12:00:00.000Z',
      idFactory: ids(),
    })
    const session = await adapter.provision(validSpec(), context())
    await adapter.attachTerminal(session.id)

    await adapter.submit(session.id)

    expect(adapter.getSession(session.id)?.phase).toBe('expired')
  })

  it('creates a fresh attempt when resetting', async () => {
    const adapter = new MockSandboxAdapter({
      now: () => '2026-09-10T12:00:00.000Z',
      idFactory: ids(),
    })
    const first = await adapter.provision(validSpec(), context())

    const second = await adapter.reset(first.id)

    expect(second.id).not.toBe(first.id)
    expect(second.attempt).toBe(first.attempt + 1)
    expect(adapter.getSession(first.id)?.phase).toBe('destroyed')
    expect(second.phase).toBe('ready')
  })

  it('destroys a session idempotently', async () => {
    const adapter = new MockSandboxAdapter({
      now: () => '2026-09-10T12:00:00.000Z',
      idFactory: ids(),
    })
    const session = await adapter.provision(validSpec(), context())

    await adapter.destroy(session.id)
    await adapter.destroy(session.id)

    expect(adapter.getSession(session.id)?.phase).toBe('destroyed')
  })
})

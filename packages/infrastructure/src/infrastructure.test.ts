import { describe, expect, it } from 'vitest'
import { MockSandboxAdapter } from '@ncuscc/sandbox-contracts'
import type { SandboxSpec } from '@ncuscc/sandbox-contracts'
import { InMemoryProfileRegistry } from './profileRegistry'
import { InMemorySessionService } from './sessionService'
import { InMemoryTerminalGateway } from './terminalGateway'
import { parsePtyMessage } from './pty'
import { TerminalTokenError } from './errors'
import { InMemoryNodePackageRegistry } from './content'
import { InMemorySessionStore, OptimisticConcurrencyError } from './store'
import { InMemoryRuntimeConnector } from './runtime'
import { defaultWorkloadSecurityContext, redactTerminalData } from './security'
import { SubmissionCoordinator } from './submission'
import { InMemorySandboxAgent } from './agent'

const profile = {
  id: 'basic-linux', version: '1', imageDigest: `sha256:${'a'.repeat(64)}` as `sha256:${string}`, runtimeClass: 'kata',
  resources: { cpuMillis: 1000, memoryMiB: 1024, ephemeralStorageMiB: 2048, pids: 256 }, tools: ['bash', 'git'], network: 'none' as const,
  terminal: { shell: '/bin/bash', pty: true }, limits: { maxLifetimeSeconds: 1800, idleTimeoutSeconds: 600, maxOutputBytes: 1000, checkerTimeoutSeconds: 10 },
}
const spec = (): SandboxSpec => ({ schemaVersion: 'sandbox.v1', id: 'node', version: '1', profileRef: 'basic-linux@1', terminal: { enabled: true, shell: '/bin/bash' }, network: { mode: 'none' }, workspace: { seedRef: 'seed/', writablePath: '/workspace', maxSizeMiB: 1024 }, lifecycle: { maxLifetimeSeconds: 1800, idleTimeoutSeconds: 600, retryPolicy: 'recreate' }, checkerRef: 'checker/node@1' })
const context = { nodeRef: 'node@1', mapRef: 'map@1', attempt: 1, participantRef: 'p1' }

describe('infrastructure layer', () => {
  it('enforces immutable profile admission and idempotent creation', async () => {
    const profiles = new InMemoryProfileRegistry([profile])
    const service = new InMemorySessionService({ adapter: new MockSandboxAdapter({ idFactory: () => 's1' }), profiles })
    const request = { spec: spec(), context, idempotencyKey: 'create-1' }
    const first = await service.create(request)
    const second = await service.create(request)
    expect(second.session.id).toBe(first.session.id)
    await expect(service.create({ ...request, idempotencyKey: 'create-2', spec: { ...spec(), terminal: { enabled: true, shell: '/bin/sh' } } })).rejects.toThrow('终端 shell')
  })

  it('binds terminal tokens and rejects malformed PTY messages', async () => {
    const profiles = new InMemoryProfileRegistry([profile])
    const service = new InMemorySessionService({ adapter: new MockSandboxAdapter({ idFactory: () => 's2' }), profiles, idFactory: () => 'token-id' })
    const session = await service.create({ spec: spec(), context, idempotencyKey: 'c' })
    const issued = await service.terminalToken(session.session.id, 'p1', 't')
    const gateway = new InMemoryTerminalGateway(service, service.tokenService())
    const connection = await gateway.connect(issued.token, session.session.id, 'p1')
    expect(connection.send({ type: 'input', data: 'git status\n' })).toEqual({ type: 'input', data: 'git status\n' })
    expect(() => parsePtyMessage({ type: 'input', data: 'x'.repeat(4097) })).toThrow()
    await service.submit(session.session.id, 'submit')
    gateway.closeSession(session.session.id, 'submitted')
    expect(connection.closed).toBe(true)
    expect(() => service.tokenService().verify(issued.token, session.session.id, 'p1')).toThrow(TerminalTokenError)
  })

  it('keeps versioned node packages and session writes optimistic', () => {
    const registry = new InMemoryNodePackageRegistry()
    registry.register({ schemaVersion: 'node-package.v1', id: 'node', version: '1', publicRef: 'public/', sandbox: spec(), checkerRef: { id: 'checker/node', version: '1', imageDigest: `sha256:${'b'.repeat(64)}` as `sha256:${string}` } })
    expect(registry.resolve('node@1').sandbox.profileRef).toBe('basic-linux@1')
    const store = new InMemorySessionStore()
    const session = { schemaVersion: 'session.v1' as const, id: 's', nodeRef: 'node@1', mapRef: 'map@1', attempt: 1, phase: 'ready' as const, createdAt: '2026-01-01T00:00:00Z', expiresAt: '2026-01-01T00:10:00Z', lastActivityAt: '2026-01-01T00:00:00Z', terminal: { protocol: 'pty-v1' as const, attachable: true } }
    store.create({ session, participantRef: 'p', profileRef: 'basic-linux@1', checkerRef: 'c@1', generation: 1, observedGeneration: 0, leaseExpiresAt: session.expiresAt, finalizer: true })
    expect(() => store.update('s', 0, (value) => value)).toThrow(OptimisticConcurrencyError)
    expect(store.update('s', 1, (value) => ({ ...value, generation: 2 })).generation).toBe(2)
  })

  it('enforces runtime isolation and security log redaction', async () => {
    const connector = new InMemoryRuntimeConnector()
    const status = await connector.provision({ sessionId: 's', name: 'sandbox-s', runtimeClass: 'kata', profile, networkMode: 'none', readOnlyRootFilesystem: true, workspacePath: '/workspace', serviceAccountToken: false })
    expect(status.agentReady).toBe(true)
    expect(redactTerminalData('TOKEN=secret Bearer abc.def')).toBe('TOKEN=[REDACTED] Bearer [REDACTED]')
    expect(defaultWorkloadSecurityContext.privileged).toBe(false)
    await connector.destroy('s')
    expect(connector.observe('s')?.phase).toBe('destroyed')
  })

  it('freezes workspace once and rejects agent writes after freeze', async () => {
    const coordinator = new SubmissionCoordinator({ check: async (workspace) => ({ schemaVersion: 'checker-result.v1', sessionId: workspace.sessionId, status: 'passed', feedback: [], metrics: {}, artifacts: [], checkerVersion: 'checker@1' }) })
    const first = await coordinator.submit('s3', 'checker@1', { 'answer.txt': 'ok' }, 1)
    const second = await coordinator.submit('s3', 'checker@1', { 'answer.txt': 'changed' }, 1)
    expect(second.snapshot.content['answer.txt']).toBe('ok')
    const agent = new InMemorySandboxAgent()
    agent.freeze()
    expect(() => agent.accept({ type: 'input', data: 'echo x' })).toThrow('冻结')
    expect(first.result.status).toBe('passed')
  })
})

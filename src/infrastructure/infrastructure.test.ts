import { describe, expect, it } from 'vitest'
import { MockSandboxAdapter } from '../sandbox/mockAdapter'
import type { SandboxSpec } from '../sandbox/types'
import { InMemoryProfileRegistry } from './profileRegistry'
import { InMemorySessionService } from './sessionService'
import { InMemoryTerminalGateway } from './terminalGateway'
import { parsePtyMessage } from './pty'
import { TerminalTokenError } from './errors'

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
})

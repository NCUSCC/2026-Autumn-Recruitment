import { describe, expect, it } from 'vitest'
import { SandboxTransitionError, canTransition, transitionSession } from './session'
import type { SandboxPhase, SandboxSession } from './types'

const now = '2026-09-10T12:01:00.000Z'

const makeSession = (phase: SandboxPhase): SandboxSession => ({
  schemaVersion: 'session.v1',
  id: 'attempt-1',
  nodeRef: 'node-example@1.0.0',
  mapRef: 'recruitment-map@1',
  attempt: 1,
  phase,
  createdAt: '2026-09-10T12:00:00.000Z',
  expiresAt: '2026-09-10T12:30:00.000Z',
  lastActivityAt: '2026-09-10T12:00:00.000Z',
  terminal: { protocol: 'pty-v1', attachable: true },
})

describe('sandbox session state machine', () => {
  it('allows the normal session lifecycle', () => {
    let session = makeSession('ready')
    session = transitionSession(session, 'running', now)
    session = transitionSession(session, 'submitted', now)
    session = transitionSession(session, 'checking', now)
    session = transitionSession(session, 'passed', now)
    expect(session.phase).toBe('passed')
  })

  it('rejects writes after a terminal phase', () => {
    expect(() => transitionSession(makeSession('destroyed'), 'running', now)).toThrowError(SandboxTransitionError)
  })

  it('allows reconnect without changing a running session phase', () => {
    expect(canTransition('running', 'running')).toBe(true)
    const session = makeSession('running')
    expect(transitionSession(session, 'running', now)).toEqual({ ...session, lastActivityAt: now })
  })

  it('returns a new object when transitioning', () => {
    const session = makeSession('ready')
    const next = transitionSession(session, 'running', now)
    expect(next).not.toBe(session)
    expect(session.phase).toBe('ready')
  })
})

import { SandboxTransitionError, transitionSession } from './session'
import {
  SandboxValidationError,
  validateCheckerResult,
  validateSandboxSpec,
} from './validation'
import type {
  AttemptContext,
  CheckerResult,
  SandboxAdapter,
  SandboxSession,
  SandboxSpec,
  TerminalAttachment,
} from './types'

type Clock = () => string
type IdFactory = () => string
type Checker = (session: SandboxSession, spec: SandboxSpec, context: AttemptContext) => CheckerResult | Promise<CheckerResult>

interface StoredSandbox {
  session: SandboxSession
  spec: SandboxSpec
  context: AttemptContext
}

export interface MockSandboxAdapterOptions {
  now?: Clock
  idFactory?: IdFactory
  checker?: Checker
}

const defaultClock: Clock = () => new Date().toISOString()
const defaultIdFactory: IdFactory = () => globalThis.crypto?.randomUUID?.() ?? `mock-${Math.random().toString(36).slice(2)}`

const cloneSession = (session: SandboxSession): SandboxSession => ({
  ...session,
  terminal: { ...session.terminal },
})

const defaultChecker: Checker = (session) => ({
  schemaVersion: 'checker-result.v1',
  sessionId: session.id,
  status: 'passed',
  feedback: [],
  metrics: {},
  artifacts: [],
  checkerVersion: 'mock@1',
})

export class MockSandboxAdapter implements SandboxAdapter {
  private readonly sessions = new Map<string, StoredSandbox>()
  private readonly now: Clock
  private readonly idFactory: IdFactory
  private readonly checker: Checker

  constructor(options: MockSandboxAdapterOptions = {}) {
    this.now = options.now ?? defaultClock
    this.idFactory = options.idFactory ?? defaultIdFactory
    this.checker = options.checker ?? defaultChecker
  }

  async provision(spec: SandboxSpec, context: AttemptContext): Promise<SandboxSession> {
    const specIssues = validateSandboxSpec(spec)
    if (specIssues.length > 0) throw new SandboxValidationError(specIssues)
    if (!Number.isInteger(context.attempt) || context.attempt < 1) {
      throw new SandboxValidationError([{ path: 'context.attempt', message: '必须是正整数' }])
    }

    const createdAt = this.now()
    const expiresAt = new Date(Date.parse(createdAt) + spec.lifecycle.maxLifetimeSeconds * 1000).toISOString()
    const id = this.idFactory()
    if (this.sessions.has(id)) throw new Error(`session id 已存在: ${id}`)

    const session: SandboxSession = {
      schemaVersion: 'session.v1',
      id,
      nodeRef: context.nodeRef,
      mapRef: context.mapRef,
      attempt: context.attempt,
      phase: 'ready',
      createdAt,
      expiresAt,
      lastActivityAt: createdAt,
      terminal: { protocol: 'pty-v1', attachable: spec.terminal.enabled },
    }
    this.sessions.set(id, { session, spec, context: { ...context } })
    return cloneSession(session)
  }

  async attachTerminal(sessionId: string): Promise<TerminalAttachment> {
    const stored = this.requireSession(sessionId)
    if (!stored.spec.terminal.enabled) throw new Error('节点未启用交互终端')
    if (stored.session.phase === 'ready') {
      stored.session = transitionSession(stored.session, 'running', this.now())
    } else if (stored.session.phase !== 'running') {
      throw new SandboxTransitionError(stored.session.phase, 'running')
    } else {
      stored.session = { ...stored.session, lastActivityAt: this.now() }
    }
    return {
      sessionId,
      protocol: 'pty-v1',
      token: `mock-terminal-${sessionId}-${this.idFactory()}`,
    }
  }

  async submit(sessionId: string): Promise<CheckerResult> {
    const stored = this.requireSession(sessionId)
    if (stored.session.phase !== 'running') throw new SandboxTransitionError(stored.session.phase, 'submitted')

    stored.session = transitionSession(stored.session, 'submitted', this.now())
    stored.session = transitionSession(stored.session, 'checking', this.now())

    let result: CheckerResult
    try {
      result = await this.checker(cloneSession(stored.session), stored.spec, { ...stored.context })
    } catch (error) {
      stored.session = transitionSession(stored.session, 'error', this.now())
      return {
        schemaVersion: 'checker-result.v1',
        sessionId,
        status: 'error',
        feedback: [{ code: 'CHECKER_ERROR', message: error instanceof Error ? error.message : 'checker 执行失败', visibility: 'organizer' }],
        metrics: {},
        artifacts: [],
        checkerVersion: stored.spec.checkerRef,
      }
    }

    const resultIssues = validateCheckerResult(result)
    if (resultIssues.length > 0) {
      stored.session = transitionSession(stored.session, 'error', this.now())
      throw new SandboxValidationError(resultIssues)
    }
    if (result.sessionId !== sessionId) {
      stored.session = transitionSession(stored.session, 'error', this.now())
      throw new SandboxValidationError([{ path: 'sessionId', message: '必须与当前 session 一致' }])
    }

    const finalPhase = result.status === 'passed'
      ? 'passed'
      : result.status === 'failed'
        ? 'failed'
        : result.status === 'timeout'
          ? 'expired'
          : 'error'
    stored.session = transitionSession(stored.session, finalPhase, this.now())
    return result
  }

  async reset(sessionId: string): Promise<SandboxSession> {
    const stored = this.requireSession(sessionId)
    const nextContext: AttemptContext = {
      ...stored.context,
      attempt: stored.context.attempt + 1,
    }
    await this.destroy(sessionId)
    return this.provision(stored.spec, nextContext)
  }

  async destroy(sessionId: string): Promise<void> {
    const stored = this.requireSession(sessionId)
    if (stored.session.phase === 'destroyed') return
    if (stored.session.phase !== 'destroying') {
      stored.session = transitionSession(stored.session, 'destroying', this.now())
    }
    stored.session = transitionSession(stored.session, 'destroyed', this.now())
  }

  async expire(sessionId: string): Promise<void> {
    const stored = this.requireSession(sessionId)
    if (stored.session.phase === 'expired' || stored.session.phase === 'destroyed') return
    if (stored.session.phase !== 'ready' && stored.session.phase !== 'running') {
      throw new SandboxTransitionError(stored.session.phase, 'expired')
    }
    stored.session = transitionSession(stored.session, 'expired', this.now())
  }

  getSession(sessionId: string): SandboxSession | undefined {
    const stored = this.sessions.get(sessionId)
    return stored ? cloneSession(stored.session) : undefined
  }

  private requireSession(sessionId: string): StoredSandbox {
    const stored = this.sessions.get(sessionId)
    if (!stored) throw new Error(`sandbox session 不存在: ${sessionId}`)
    return stored
  }
}

import type { CheckerResult, SandboxSession } from '@ncuscc/sandbox-contracts'
import { SandboxTransitionError } from '@ncuscc/sandbox-contracts'
import { SessionNotFoundError, IdempotencyConflictError } from './errors'
import { InMemorySnapshotStore } from './snapshot'
import { TerminalTokenService } from './token'
import { admitSandboxSpec } from './admission'
import type { FrozenWorkspace, PublicSession, SessionRequest, SessionService, SessionServiceOptions, TerminalToken } from './types'
import type { SessionStore } from './store'

type StoredResult = { fingerprint: string; value: unknown }

const fingerprint = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(fingerprint).join(',')}]`
  return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${fingerprint(item)}`).join(',')}}`
}

export class InMemorySessionService implements SessionService {
  private readonly keys = new Map<string, StoredResult>()
  private readonly inflight = new Map<string, { fingerprint: string; promise: Promise<PublicSession> }>()
  private readonly results = new Map<string, CheckerResult>()
  private readonly frozen = new Map<string, FrozenWorkspace>()
  private readonly snapshots
  private readonly now
  private readonly tokens
  private readonly audit
  private readonly store?: SessionStore
  private readonly specs = new Map<string, { idleTimeoutSeconds: number; participantRef: string }>()
  constructor(private readonly options: SessionServiceOptions) {
    this.now = options.now ?? (() => new Date().toISOString())
    this.snapshots = options.snapshots ?? new InMemorySnapshotStore(this.now, options.idFactory)
    this.tokens = new TerminalTokenService(this.now, options.idFactory, options.tokenTtlSeconds ?? 60)
    this.audit = options.audit ?? (() => undefined)
    this.store = options.store
  }
  async create(request: SessionRequest): Promise<PublicSession> {
    const keyResult = this.cached(request.idempotencyKey, request)
    if (keyResult) return keyResult as PublicSession
    const pending = this.inflight.get(request.idempotencyKey)
    if (pending) {
      if (pending.fingerprint !== fingerprint(request)) throw new IdempotencyConflictError(request.idempotencyKey)
      return pending.promise
    }
    const operation = this.provision(request)
    this.inflight.set(request.idempotencyKey, { fingerprint: fingerprint(request), promise: operation })
    try { return await operation } finally { this.inflight.delete(request.idempotencyKey) }
  }
  private async provision(request: SessionRequest): Promise<PublicSession> {
    const profile = this.options.profiles.resolve(request.spec.profileRef)
    admitSandboxSpec(request.spec, profile)
    const session = await this.options.adapter.provision(request.spec, request.context)
    const result = { session, terminalAvailable: session.terminal.attachable }
    this.specs.set(session.id, { idleTimeoutSeconds: request.spec.lifecycle.idleTimeoutSeconds, participantRef: request.context.participantRef })
    this.store?.create({ session, participantRef: request.context.participantRef, profileRef: request.spec.profileRef, checkerRef: request.spec.checkerRef, generation: 1, observedGeneration: 0, leaseExpiresAt: session.expiresAt, finalizer: true })
    this.keys.set(request.idempotencyKey, { fingerprint: fingerprint(request), value: result })
    this.audit({ type: 'session.created', sessionId: session.id, participantRef: request.context.participantRef, at: this.now() })
    this.options.observability?.increment('sessionsCreated')
    if (session.phase === 'ready') this.options.observability?.increment('sessionsReady')
    return this.public(result)
  }
  get(sessionId: string): PublicSession | undefined {
    const session = this.options.adapter.getSession(sessionId) ?? this.store?.get(sessionId)?.session
    return session ? this.public({ session, terminalAvailable: session.terminal.attachable, result: this.results.get(sessionId) }) : undefined
  }
  async terminalToken(sessionId: string, participantRef: string, idempotencyKey: string): Promise<TerminalToken> {
    const current = this.require(sessionId)
    const request = { sessionId, participantRef }
    const cached = this.cached(idempotencyKey, request)
    if (cached) return cached as TerminalToken
    if (!current.terminalAvailable || !['ready', 'running'].includes(current.session.phase)) throw new SandboxTransitionError(current.session.phase, 'running')
    await this.options.adapter.attachTerminal(sessionId)
    const token = this.tokens.issue(sessionId, participantRef)
    // The gateway token is independent of the runtime attachment handle.
    const value = { ...token, token: token.token }
    this.keys.set(idempotencyKey, { fingerprint: fingerprint(request), value })
    this.audit({ type: 'terminal.token.issued', sessionId, participantRef, at: this.now() })
    this.options.observability?.increment('terminalConnections')
    return value
  }
  async submit(sessionId: string, idempotencyKey: string): Promise<CheckerResult> {
    const cached = this.cached(idempotencyKey, { sessionId })
    if (cached) return cached as CheckerResult
    const current = this.require(sessionId)
    if (current.session.phase !== 'running') throw new SandboxTransitionError(current.session.phase, 'submitted')
    // The mock adapter has no host filesystem; an empty immutable snapshot models
    // the freeze boundary that a runtime adapter fills with workspace contents.
    this.frozen.set(sessionId, this.snapshots.freeze(sessionId, '/workspace', {}))
    const result = await this.options.adapter.submit(sessionId)
    this.results.set(sessionId, result)
    this.persistSession(sessionId)
    this.tokens.revokeSession(sessionId)
    this.keys.set(idempotencyKey, { fingerprint: fingerprint({ sessionId }), value: result })
    this.audit({ type: 'session.submitted', sessionId, at: this.now() })
    this.options.observability?.increment('sessionsSubmitted')
    const metric = result.status === 'passed' ? 'checkerPassed' : result.status === 'failed' ? 'checkerFailed' : result.status === 'timeout' ? 'checkerTimeouts' : 'checkerErrors'
    this.options.observability?.increment(metric)
    return result
  }
  async reset(sessionId: string, idempotencyKey: string): Promise<PublicSession> {
    const cached = this.cached(idempotencyKey, { sessionId })
    if (cached) return cached as PublicSession
    const next = await this.options.adapter.reset(sessionId)
    this.persistSession(sessionId)
    const source = this.options.adapter.getSession(next.id)
    const oldPolicy = this.specs.get(sessionId)
    if (oldPolicy) this.specs.set(next.id, oldPolicy)
    const oldRecord = this.store?.get(sessionId)
    if (source) this.store?.create({ session: source, participantRef: oldPolicy?.participantRef ?? '', profileRef: oldRecord?.profileRef ?? '', checkerRef: oldRecord?.checkerRef ?? '', generation: 1, observedGeneration: 0, leaseExpiresAt: source.expiresAt, finalizer: true })
    const value = { session: next, terminalAvailable: next.terminal.attachable }
    this.keys.set(idempotencyKey, { fingerprint: fingerprint({ sessionId }), value })
    this.audit({ type: 'session.reset', sessionId, at: this.now() })
    return value
  }
  async destroy(sessionId: string, idempotencyKey: string): Promise<void> {
    const cached = this.cached(idempotencyKey, { sessionId }); if (cached) return
    this.require(sessionId); await this.options.adapter.destroy(sessionId); this.persistSession(sessionId)
    this.tokens.revokeSession(sessionId); this.keys.set(idempotencyKey, { fingerprint: fingerprint({ sessionId }), value: true })
    this.audit({ type: 'session.destroyed', sessionId, at: this.now() })
    this.options.observability?.increment('sessionsDestroyed')
  }
  async expire(at = this.now()): Promise<string[]> {
    const expired: string[] = []
    for (const id of this.sessionIds()) {
      const item = this.options.adapter.getSession(id)
      const policy = this.specs.get(id)
      const idleExpired = item && policy && Date.parse(at) - Date.parse(item.lastActivityAt) >= policy.idleTimeoutSeconds * 1000
      if (item && ['ready', 'running'].includes(item.phase) && (Date.parse(item.expiresAt) <= Date.parse(at) || idleExpired)) { if (this.options.adapter.expire) await this.options.adapter.expire(id); else await this.options.adapter.destroy(id); this.persistSession(id); this.tokens.revokeSession(id); expired.push(id) }
    }
    return expired
  }
  tokenService(): TerminalTokenService { return this.tokens }
  snapshot(sessionId: string) { return this.frozen.get(sessionId) }
  touch(sessionId: string, participantRef: string, at = this.now()): void {
    const policy = this.specs.get(sessionId)
    if (!policy || policy.participantRef !== participantRef) throw new Error('session participant 不匹配')
    const current = this.options.adapter.getSession(sessionId)
    if (!current || !['ready', 'running'].includes(current.phase)) throw new SandboxTransitionError(current?.phase ?? 'destroyed', 'running')
    if (this.options.adapter.touch) void this.options.adapter.touch(sessionId, at)
    this.persistSession({ ...current, lastActivityAt: at })
  }
  private sessionIds(): string[] {
    const ids: string[] = []
    for (const key of this.keys.values()) { const value = key.value as PublicSession; if (value?.session?.id) ids.push(value.session.id) }
    if (this.store) ids.push(...this.store.list().map((record) => record.session.id))
    return [...new Set(ids)]
  }
  private require(id: string): PublicSession { const value = this.get(id); if (!value) throw new SessionNotFoundError(id); return value }
  private persistSession(sessionIdOrValue: string | SandboxSession): void {
    const session = typeof sessionIdOrValue === 'string' ? this.options.adapter.getSession(sessionIdOrValue) : sessionIdOrValue
    if (!session || !this.store) return
    const current = this.store.get(session.id)
    if (!current) return
    this.store.update(session.id, current.generation, (record) => ({ ...record, session, generation: record.generation + 1, observedGeneration: record.observedGeneration + 1 }))
  }
  private cached(key: string, request: unknown): unknown { const existing = this.keys.get(key); if (!existing) return undefined; if (existing.fingerprint !== fingerprint(request)) throw new IdempotencyConflictError(key); return existing.value }
  private public(value: PublicSession): PublicSession { return { session: { ...value.session, terminal: { ...value.session.terminal } }, terminalAvailable: value.terminalAvailable, result: value.result } }
}

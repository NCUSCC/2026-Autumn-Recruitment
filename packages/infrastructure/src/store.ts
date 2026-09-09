import type { SandboxSession } from '@ncuscc/sandbox-contracts'

export interface SessionRecord {
  session: SandboxSession
  participantRef: string
  profileRef: string
  checkerRef: string
  generation: number
  observedGeneration: number
  leaseExpiresAt: string
  finalizer: boolean
}
export interface SessionStore {
  create(record: SessionRecord): SessionRecord
  get(sessionId: string): SessionRecord | undefined
  list(): SessionRecord[]
  update(sessionId: string, expectedGeneration: number, update: (record: SessionRecord) => SessionRecord): SessionRecord
  remove(sessionId: string): void
}

const clone = (record: SessionRecord): SessionRecord => ({ ...record, session: { ...record.session, terminal: { ...record.session.terminal } } })

export class OptimisticConcurrencyError extends Error {
  constructor(message: string) { super(message); this.name = 'OptimisticConcurrencyError' }
}

export class InMemorySessionStore implements SessionStore {
  private readonly records = new Map<string, SessionRecord>()
  create(record: SessionRecord): SessionRecord {
    if (this.records.has(record.session.id)) throw new OptimisticConcurrencyError(`session 已存在: ${record.session.id}`)
    this.records.set(record.session.id, clone(record))
    return clone(record)
  }
  get(sessionId: string): SessionRecord | undefined { const value = this.records.get(sessionId); return value ? clone(value) : undefined }
  list(): SessionRecord[] { return [...this.records.values()].map(clone) }
  update(sessionId: string, expectedGeneration: number, update: (record: SessionRecord) => SessionRecord): SessionRecord {
    const current = this.records.get(sessionId)
    if (!current) throw new Error(`session 不存在: ${sessionId}`)
    if (current.generation !== expectedGeneration) throw new OptimisticConcurrencyError(`session generation 冲突: ${sessionId}`)
    const next = update(clone(current))
    if (next.session.id !== sessionId || next.generation !== expectedGeneration + 1) throw new OptimisticConcurrencyError('更新必须递增 generation 且保持 session ID')
    this.records.set(sessionId, clone(next))
    return clone(next)
  }
  remove(sessionId: string): void { this.records.delete(sessionId) }
}

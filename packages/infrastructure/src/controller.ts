import type { PublicSession, SessionRequest } from './types'
import type { InMemorySessionService } from './sessionService'
import { InMemoryObservability } from './observability'

export interface ReconcileStatus { sessionId: string; phase: string; observedAt: string; orphaned: boolean }

/** Small controller-shaped facade; a Kubernetes controller can replace its storage/reconcile loop. */
export class InMemorySandboxController {
  private readonly desired = new Map<string, SessionRequest>()
  constructor(private readonly service: InMemorySessionService, private readonly observability = new InMemoryObservability(), private readonly now = () => new Date().toISOString()) {}
  async create(request: SessionRequest): Promise<PublicSession> {
    const result = await this.service.create(request)
    this.desired.set(result.session.id, request)
    this.observability.increment('sessionsCreated')
    if (result.session.phase === 'ready') this.observability.increment('sessionsReady')
    return result
  }
  reconcile(sessionId: string): ReconcileStatus {
    const current = this.service.get(sessionId)
    const orphaned = !current && this.desired.has(sessionId)
    if (orphaned) this.observability.increment('orphanedSessions')
    return { sessionId, phase: current?.session.phase ?? 'orphaned', observedAt: this.now(), orphaned }
  }
  async reconcileAll(): Promise<ReconcileStatus[]> { return [...this.desired.keys()].map((id) => this.reconcile(id)) }
}

import type { CheckerResult } from '@ncuscc/sandbox-contracts'
import type { PublicSession, SessionRequest, TerminalToken } from './types'
import { InMemorySessionService } from './sessionService'

/** Transport-neutral implementation of the documented HTTP API. */
export class SessionApi {
  constructor(private readonly service: InMemorySessionService) {}
  create(request: SessionRequest): Promise<PublicSession> { return this.service.create(request) }
  get(sessionId: string): PublicSession | undefined { return this.service.get(sessionId) }
  terminalToken(sessionId: string, participantRef: string, idempotencyKey: string): Promise<TerminalToken> { return this.service.terminalToken(sessionId, participantRef, idempotencyKey) }
  submit(sessionId: string, idempotencyKey: string): Promise<CheckerResult> { return this.service.submit(sessionId, idempotencyKey) }
  reset(sessionId: string, idempotencyKey: string): Promise<PublicSession> { return this.service.reset(sessionId, idempotencyKey) }
  destroy(sessionId: string, idempotencyKey: string): Promise<void> { return this.service.destroy(sessionId, idempotencyKey) }
}

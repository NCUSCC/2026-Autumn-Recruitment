import { TerminalTokenError } from './errors'
import type { TerminalToken } from './types'

type Clock = () => string
type IdFactory = () => string

export class TerminalTokenService {
  private readonly tokens = new Map<string, TerminalToken>()
  constructor(private readonly now: Clock = () => new Date().toISOString(), private readonly idFactory: IdFactory = () => globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2), private readonly ttlSeconds = 60) {}
  issue(sessionId: string, participantRef: string): TerminalToken {
    const expiresAt = new Date(Date.parse(this.now()) + this.ttlSeconds * 1000).toISOString()
    const token = `tt-${this.idFactory()}`
    const value = { token, sessionId, participantRef, expiresAt }
    this.tokens.set(token, value)
    return { ...value }
  }
  verify(token: string, sessionId: string, participantRef?: string, at = this.now()): TerminalToken {
    const value = this.tokens.get(token)
    if (!value || Date.parse(value.expiresAt) <= Date.parse(at) || value.sessionId !== sessionId || (participantRef !== undefined && value.participantRef !== participantRef)) throw new TerminalTokenError('终端 token 无效、已过期或绑定不匹配')
    return { ...value }
  }
  revokeSession(sessionId: string): void { for (const [key, value] of this.tokens) if (value.sessionId === sessionId) this.tokens.delete(key) }
}

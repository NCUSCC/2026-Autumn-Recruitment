import type { PtyMessage, TerminalOutputMessage } from './types'
import { parsePtyMessage } from './pty'
import { TerminalTokenService } from './token'
import { SessionNotFoundError } from './errors'
import type { SessionService } from './types'

export interface TerminalConnection {
  readonly id: string
  readonly sessionId: string
  send(raw: unknown): PtyMessage | undefined
  close(reason: 'submitted' | 'expired' | 'destroyed' | 'policy'): void
  readonly closed: boolean
}

export class InMemoryTerminalGateway {
  private readonly connections = new Map<string, { sessionId: string; participantRef: string; closed: boolean }>()
  private readonly outputBytes = new Map<string, number>()
  private readonly outputWindows = new Map<string, { startedAt: number; bytes: number }>()
  constructor(private readonly service: SessionService, private readonly tokens: TerminalTokenService, private readonly maxConnections = 1, private readonly idFactory: () => string = () => globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2), private readonly maxOutputBytesPerSecond = 1024 * 1024) {}
  async connect(token: string, sessionId: string, participantRef: string): Promise<TerminalConnection> {
    this.tokens.verify(token, sessionId, participantRef)
    const session = this.service.get(sessionId)
    if (!session) throw new SessionNotFoundError(sessionId)
    if (!['ready', 'running'].includes(session.session.phase)) throw new Error('session 当前不允许终端连接')
    const active = [...this.connections.values()].filter((item) => item.sessionId === sessionId && !item.closed).length
    if (active >= this.maxConnections) throw new Error('终端连接数已达上限')
    const id = this.idFactory()
    const state = { sessionId, participantRef, closed: false }
    this.connections.set(id, state)
    this.outputBytes.set(id, 0)
    this.outputWindows.set(id, { startedAt: Date.now(), bytes: 0 })
    let connection: TerminalConnection
    connection = {
      id, sessionId,
      get closed() { return state.closed },
      send: (raw) => {
        if (state.closed) throw new Error('终端连接已关闭')
        const current = this.service.get(sessionId)
        if (!current || !['ready', 'running'].includes(current.session.phase)) { state.closed = true; throw new Error('session 已冻结，拒绝终端写入') }
        const message = parsePtyMessage(raw)
        if (message.type === 'input' || message.type === 'resize' || message.type === 'heartbeat') this.service.touch(sessionId, participantRef)
        return message
      },
      close: (reason) => { state.closed = true; this.tokens.revokeSession(reason === 'submitted' || reason === 'expired' || reason === 'destroyed' ? sessionId : '') },
    }
    return connection
  }
  /** Apply the profile's cumulative output limit before forwarding data to a browser. */
  pushOutput(connectionId: string, data: string, maxOutputBytes: number): TerminalOutputMessage {
    const state = this.connections.get(connectionId)
    if (!state || state.closed) throw new Error('终端连接已关闭')
    const next = (this.outputBytes.get(connectionId) ?? 0) + new TextEncoder().encode(data).byteLength
    if (next > maxOutputBytes) { state.closed = true; throw new Error('终端输出超过 profile 配额') }
    const now = Date.now()
    const window = this.outputWindows.get(connectionId) ?? { startedAt: now, bytes: 0 }
    if (now - window.startedAt >= 1000) { window.startedAt = now; window.bytes = 0 }
    const bytes = new TextEncoder().encode(data).byteLength
    if (window.bytes + bytes > this.maxOutputBytesPerSecond) { state.closed = true; throw new Error('终端输出速率超过 profile 配额') }
    window.bytes += bytes
    this.outputWindows.set(connectionId, window)
    this.outputBytes.set(connectionId, next)
    return { type: 'output', data }
  }
  closeSession(sessionId: string, reason: 'submitted' | 'expired' | 'destroyed' | 'policy'): void { for (const value of this.connections.values()) if (value.sessionId === sessionId) value.closed = true; this.tokens.revokeSession(sessionId); void reason }
}

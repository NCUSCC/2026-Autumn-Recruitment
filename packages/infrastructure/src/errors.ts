export class InfrastructureError extends Error {
  constructor(message: string, public readonly code: string, options?: { cause?: unknown }) {
    super(message)
    if (options?.cause !== undefined) (this as Error & { cause?: unknown }).cause = options.cause
    this.name = 'InfrastructureError'
  }
}

export class IdempotencyConflictError extends InfrastructureError {
  constructor(key: string) { super(`幂等 key 已用于不同请求: ${key}`, 'IDEMPOTENCY_CONFLICT') }
}

export class SessionNotFoundError extends InfrastructureError {
  constructor(sessionId: string) { super(`sandbox session 不存在: ${sessionId}`, 'SESSION_NOT_FOUND') }
}

export class TerminalTokenError extends InfrastructureError {
  constructor(message: string) { super(message, 'TERMINAL_TOKEN_INVALID') }
}

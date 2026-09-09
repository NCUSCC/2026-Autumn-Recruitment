import type { AuditEvent, InfrastructureMetrics } from './types'

export class InMemoryObservability {
  readonly metrics: InfrastructureMetrics = { sessionsCreated: 0, sessionsReady: 0, sessionsSubmitted: 0, checkerPassed: 0, checkerFailed: 0, checkerErrors: 0, checkerTimeouts: 0, terminalConnections: 0, terminalReconnects: 0, terminalRejected: 0, sessionsDestroyed: 0, orphanedSessions: 0 }
  readonly events: AuditEvent[] = []
  record(event: AuditEvent): void { this.events.push({ ...event, details: event.details ? { ...event.details } : undefined }) }
  increment(metric: keyof InfrastructureMetrics, amount = 1): void { this.metrics[metric] += amount }
  snapshot(): InfrastructureMetrics { return { ...this.metrics } }
}

import type { PtyMessage } from './types'

export interface AgentStatus { frozen: boolean; lastHeartbeatAt: string; processCount: number }

export class InMemorySandboxAgent {
  private frozen = false
  private processCount = 0
  private lastHeartbeatAt: string
  constructor(private readonly now = () => new Date().toISOString()) { this.lastHeartbeatAt = now() }
  heartbeat(): AgentStatus { this.lastHeartbeatAt = this.now(); return this.status() }
  accept(message: PtyMessage): void {
    if (this.frozen && (message.type === 'input' || message.type === 'resize')) throw new Error('workspace 已冻结，拒绝 agent 写入')
    if (message.type === 'input') this.processCount += 1
    this.lastHeartbeatAt = this.now()
  }
  freeze(): AgentStatus { this.frozen = true; return this.status() }
  status(): AgentStatus { return { frozen: this.frozen, lastHeartbeatAt: this.lastHeartbeatAt, processCount: this.processCount } }
}

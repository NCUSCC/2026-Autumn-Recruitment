import type { CheckerResult } from '@ncuscc/sandbox-contracts'
import { CheckerController } from './checker'
import type { CheckerAdapter, FrozenWorkspace, SnapshotStore } from './types'
import { InMemorySnapshotStore } from './snapshot'

export interface Submission {
  sessionId: string
  snapshot: FrozenWorkspace
  result: CheckerResult
}
/** Coordinates the immutable freeze -> isolated checker -> structured result boundary. */
export class SubmissionCoordinator {
  private readonly submitted = new Map<string, Submission>()
  private readonly snapshots: SnapshotStore
  private readonly checker: CheckerController
  constructor(adapter: CheckerAdapter, snapshots: SnapshotStore = new InMemorySnapshotStore(), checkerTimeoutMs = 120_000) {
    this.snapshots = snapshots
    this.checker = new CheckerController(adapter, checkerTimeoutMs)
  }
  async submit(sessionId: string, checkerRef: string, content: Record<string, string>, timeoutSeconds: number): Promise<Submission> {
    const existing = this.submitted.get(sessionId)
    if (existing) return existing
    const snapshot = this.snapshots.freeze(sessionId, '/workspace', content)
    const result = await this.checker.run(snapshot, checkerRef, timeoutSeconds)
    const submission = Object.freeze({ sessionId, snapshot, result })
    this.submitted.set(sessionId, submission)
    return submission
  }
  get(sessionId: string): Submission | undefined { return this.submitted.get(sessionId) }
}

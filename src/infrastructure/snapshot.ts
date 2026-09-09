import type { FrozenWorkspace, SnapshotStore } from './types'

export class InMemorySnapshotStore implements SnapshotStore {
  private readonly snapshots = new Map<string, FrozenWorkspace>()
  constructor(private readonly now: () => string = () => new Date().toISOString(), private readonly idFactory: () => string = () => globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)) {}
  freeze(sessionId: string, workspacePath: string, content: Record<string, string>): FrozenWorkspace {
    const snapshot: FrozenWorkspace = Object.freeze({ snapshotId: `snapshot-${this.idFactory()}`, sessionId, workspacePath, content: Object.freeze({ ...content }), createdAt: this.now() })
    this.snapshots.set(snapshot.snapshotId, snapshot)
    return snapshot
  }
  get(snapshotId: string): FrozenWorkspace | undefined { return this.snapshots.get(snapshotId) }
  delete(snapshotId: string): void { this.snapshots.delete(snapshotId) }
}

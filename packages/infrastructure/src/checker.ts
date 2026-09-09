import type { CheckerAdapter, CheckerResult, FrozenWorkspace } from './types'
import { validateCheckerResult, SandboxValidationError } from '@ncuscc/sandbox-contracts'

export class FunctionCheckerAdapter implements CheckerAdapter {
  constructor(private readonly fn: (workspace: FrozenWorkspace, checkerRef: string) => CheckerResult | Promise<CheckerResult>) {}
  async check(workspace: FrozenWorkspace, checkerRef: string, _timeoutSeconds = 0): Promise<CheckerResult> {
    const result = await this.fn(workspace, checkerRef)
    const issues = validateCheckerResult(result)
    if (issues.length) throw new SandboxValidationError(issues)
    if (result.sessionId !== workspace.sessionId) throw new SandboxValidationError([{ path: 'sessionId', message: '必须与快照 session 一致' }])
    return result
  }
}
export class CheckerController {
  constructor(private readonly adapter: CheckerAdapter, private readonly timeoutMs = 120_000) {}
  async run(workspace: FrozenWorkspace, checkerRef: string, timeoutSeconds: number): Promise<CheckerResult> {
    const timeout = Math.min(this.timeoutMs, timeoutSeconds * 1000)
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      return await Promise.race([
        this.adapter.check(workspace, checkerRef, timeoutSeconds),
        new Promise<CheckerResult>((resolve) => { timer = setTimeout(() => resolve({ schemaVersion: 'checker-result.v1', sessionId: workspace.sessionId, status: 'timeout', feedback: [], metrics: {}, artifacts: [], checkerVersion: checkerRef }), timeout) }),
      ])
    } finally { if (timer) clearTimeout(timer) }
  }
}

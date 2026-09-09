import type { SandboxPhase, SandboxSession } from './types'

const phases: SandboxPhase[] = [
  'pending',
  'provisioning',
  'ready',
  'running',
  'submitted',
  'checking',
  'passed',
  'failed',
  'error',
  'expired',
  'resetting',
  'destroying',
  'destroyed',
]

const transitionTable: Record<SandboxPhase, SandboxPhase[]> = {
  pending: ['provisioning'],
  provisioning: ['ready', 'error'],
  ready: ['running', 'expired'],
  running: ['submitted', 'expired'],
  submitted: ['checking'],
  checking: ['passed', 'failed', 'error', 'expired'],
  passed: [],
  failed: [],
  error: [],
  expired: [],
  resetting: ['provisioning'],
  destroying: ['destroyed'],
  destroyed: [],
}

const terminalPhases = new Set<SandboxPhase>(['passed', 'failed', 'error', 'expired', 'destroyed'])

export class SandboxTransitionError extends Error {
  constructor(public readonly from: SandboxPhase, public readonly to: SandboxPhase) {
    super(`不允许将 sandbox session 从 ${from} 转为 ${to}`)
    this.name = 'SandboxTransitionError'
  }
}

export const canTransition = (from: SandboxPhase, to: SandboxPhase): boolean => {
  if (!phases.includes(from) || !phases.includes(to)) return false
  if (from === 'destroyed') return false
  if (from === to) return !terminalPhases.has(from)
  if (to === 'destroying') return true
  if (from === 'destroying') return to === 'destroyed'
  return transitionTable[from].includes(to)
}

export const transitionSession = (session: SandboxSession, nextPhase: SandboxPhase, at: string): SandboxSession => {
  if (!canTransition(session.phase, nextPhase)) throw new SandboxTransitionError(session.phase, nextPhase)
  return {
    ...session,
    phase: nextPhase,
    lastActivityAt: at,
  }
}

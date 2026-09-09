const secretAssignment = /((?:password|passwd|token|secret|api[_-]?key|authorization)\s*[=:]\s*)([^\s]+)/gi
const bearer = /(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi

/** Remove common credential-shaped values before terminal data enters logs. */
export const redactTerminalData = (data: string): string => data.replace(secretAssignment, '$1[REDACTED]').replace(bearer, '$1[REDACTED]')

export interface WorkloadSecurityContext {
  runAsNonRoot: true
  privileged: false
  readOnlyRootFilesystem: true
  allowPrivilegeEscalation: false
  hostNetwork: false
  hostPID: false
  hostIPC: false
  automountServiceAccountToken: false
  capabilitiesDrop: readonly ['ALL']
}

export const defaultWorkloadSecurityContext: WorkloadSecurityContext = Object.freeze({
  runAsNonRoot: true, privileged: false, readOnlyRootFilesystem: true, allowPrivilegeEscalation: false,
  hostNetwork: false, hostPID: false, hostIPC: false, automountServiceAccountToken: false, capabilitiesDrop: ['ALL'] as const,
})

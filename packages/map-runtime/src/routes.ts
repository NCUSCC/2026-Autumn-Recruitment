import type { CheckerResult } from '@ncuscc/sandbox-contracts'
import type { MapDocument, MapEdge } from '@ncuscc/assessment-schema'

/** Resolve map transitions from checker output without allowing a checker to mutate topology. */
export const resolveCheckerEdges = (map: MapDocument, nodeId: string, result: CheckerResult): MapEdge[] => {
  const trigger = result.status === 'passed' ? 'success' : 'failure'
  return map.edges.filter((edge) => edge.source === nodeId && edge.trigger === trigger)
}

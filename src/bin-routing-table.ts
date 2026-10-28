export type PaymentRailNetwork = "VISA" | "MASTERCARD" | "STAR" | "NYCE" | "PULSE" | "ACCEL";

export interface RailRouteCandidate {
  readonly network: PaymentRailNetwork;
  readonly acquirerId: string;
  readonly estimatedFeeBps: number;
  readonly historicalAuthRateBps: number; // e.g., 9850 = 98.50%
  readonly averageLatencyMs: number;
}

export interface SmartRoutingDecision {
  readonly selectedRail: PaymentRailNetwork;
  readonly selectedAcquirerId: string;
  readonly routingScore: number;
  readonly regIILeastCostApplied: boolean;
}

export function selectOptimalPaymentRail(
  candidates: readonly RailRouteCandidate[],
  optimizeFor: "LEAST_COST" | "MAX_CONVERSION"
): SmartRoutingDecision {
  if (candidates.length === 0) {
    throw new Error("ROUTING_ERR: At least one payment rail candidate is required");
  }

  let bestCandidate = candidates[0];
  if (!bestCandidate) {
    throw new Error("ROUTING_ERR: Invalid candidate list");
  }
  let bestScore = -Infinity;

  for (const candidate of candidates) {
    const authWeight = optimizeFor === "MAX_CONVERSION" ? 2.5 : 1.0;
    const costPenaltyWeight = optimizeFor === "LEAST_COST" ? 8.0 : 2.0;
    const latencyPenalty = candidate.averageLatencyMs * 0.05;

    const score =
      candidate.historicalAuthRateBps * authWeight -
      candidate.estimatedFeeBps * costPenaltyWeight -
      latencyPenalty;

    if (score > bestScore) {
      bestScore = score;
      bestCandidate = candidate;
    }
  }

  const pinlessDebitNetworks = new Set<PaymentRailNetwork>(["STAR", "NYCE", "PULSE", "ACCEL"]);

  return {
    selectedRail: bestCandidate.network,
    selectedAcquirerId: bestCandidate.acquirerId,
    routingScore: Math.round(bestScore * 100) / 100,
    regIILeastCostApplied: pinlessDebitNetworks.has(bestCandidate.network),
  };
}

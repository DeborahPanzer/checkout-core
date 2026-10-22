export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface GatewayHealthSnapshot {
  providerId: string;
  state: CircuitState;
  consecutiveFailures: number;
  lastFailureTimestamp: number | null;
}

/**
 * Deterministic Circuit Breaker governing payment gateway routing and automated failover.
 */
export class GatewayCircuitBreaker {
  private readonly failureThreshold: number;
  private readonly cooldownMs: number;
  private readonly healthMap = new Map<
    string,
    { failures: number; lastFailureAt: number | null; state: CircuitState }
  >();

  constructor(failureThreshold = 3, cooldownMs = 30_000) {
    this.failureThreshold = failureThreshold;
    this.cooldownMs = cooldownMs;
  }

  public selectHealthyProvider(
    primaryProvider: string,
    fallbackProvider: string,
    nowMs = Date.now()
  ): { selectedProvider: string; failoverTriggered: boolean; circuitState: CircuitState } {
    const primaryState = this.evaluateState(primaryProvider, nowMs);

    if (primaryState === 'OPEN') {
      return {
        selectedProvider: fallbackProvider,
        failoverTriggered: true,
        circuitState: primaryState,
      };
    }

    return {
      selectedProvider: primaryProvider,
      failoverTriggered: false,
      circuitState: primaryState,
    };
  }

  public recordSuccess(providerId: string): void {
    this.healthMap.set(providerId, {
      failures: 0,
      lastFailureAt: null,
      state: 'CLOSED',
    });
  }

  public recordFailure(providerId: string, nowMs = Date.now()): CircuitState {
    const current = this.healthMap.get(providerId) ?? {
      failures: 0,
      lastFailureAt: null,
      state: 'CLOSED' as CircuitState,
    };

    const failures = current.failures + 1;
    const state: CircuitState = failures >= this.failureThreshold ? 'OPEN' : 'CLOSED';

    this.healthMap.set(providerId, {
      failures,
      lastFailureAt: nowMs,
      state,
    });

    return state;
  }

  public evaluateState(providerId: string, nowMs = Date.now()): CircuitState {
    const record = this.healthMap.get(providerId);
    if (!record) {
      return 'CLOSED';
    }

    if (record.state === 'OPEN' && record.lastFailureAt !== null) {
      if (nowMs - record.lastFailureAt >= this.cooldownMs) {
        record.state = 'HALF_OPEN';
        return 'HALF_OPEN';
      }
    }

    return record.state;
  }
}

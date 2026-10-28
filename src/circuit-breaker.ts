export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface GatewayHealthMetrics {
  readonly gatewayId: string;
  readonly state: CircuitState;
  readonly consecutiveFailures: number;
  readonly totalRequests: number;
  readonly totalFailures: number;
  readonly lastStateChangedAt: number;
}

export interface CircuitBreakerConfig {
  readonly failureThreshold: number;
  readonly recoveryTimeoutMs: number;
  readonly halfOpenSuccessThreshold: number;
}

export class GatewayCircuitBreaker {
  private state: CircuitState = "CLOSED";
  private consecutiveFailures = 0;
  private halfOpenSuccesses = 0;
  private totalRequests = 0;
  private totalFailures = 0;
  private lastFailureTime = 0;
  private lastStateChangedAt = Date.now();

  constructor(
    public readonly gatewayId: string,
    private readonly config: CircuitBreakerConfig
  ) {}

  public canExecute(nowMs: number = Date.now()): boolean {
    if (this.state === "CLOSED") {
      return true;
    }
    if (this.state === "OPEN") {
      if (nowMs - this.lastFailureTime >= this.config.recoveryTimeoutMs) {
        this.transitionTo("HALF_OPEN", nowMs);
        return true;
      }
      return false;
    }
    return true;
  }

  public recordSuccess(nowMs: number = Date.now()): void {
    this.totalRequests += 1;
    this.consecutiveFailures = 0;

    if (this.state === "HALF_OPEN") {
      this.halfOpenSuccesses += 1;
      if (this.halfOpenSuccesses >= this.config.halfOpenSuccessThreshold) {
        this.transitionTo("CLOSED", nowMs);
      }
    }
  }

  public recordFailure(nowMs: number = Date.now()): void {
    this.totalRequests += 1;
    this.totalFailures += 1;
    this.consecutiveFailures += 1;
    this.lastFailureTime = nowMs;

    if (this.state === "HALF_OPEN" || this.consecutiveFailures >= this.config.failureThreshold) {
      this.transitionTo("OPEN", nowMs);
    }
  }

  public getMetrics(): GatewayHealthMetrics {
    return {
      gatewayId: this.gatewayId,
      state: this.state,
      consecutiveFailures: this.consecutiveFailures,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
      lastStateChangedAt: this.lastStateChangedAt,
    };
  }

  private transitionTo(nextState: CircuitState, nowMs: number): void {
    if (this.state !== nextState) {
      this.state = nextState;
      this.lastStateChangedAt = nowMs;
      this.halfOpenSuccesses = 0;
    }
  }
}

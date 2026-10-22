export interface VelocityCheckOptions {
  maxAttempts: number;
  windowMs: number;
}

/**
 * High-performance sliding-window velocity tracker for fraud prevention and card-testing mitigation.
 */
export class FraudVelocityTracker {
  private readonly attemptsStore = new Map<string, number[]>();

  public assertAllowed(identifier: string, options: VelocityCheckOptions = { maxAttempts: 5, windowMs: 60_000 }, nowMs = Date.now()): void {
    const timestamps = this.attemptsStore.get(identifier) ?? [];
    const cutoff = nowMs - options.windowMs;

    // Filter out-of-window attempts
    const recentAttempts = timestamps.filter((t) => t > cutoff);

    if (recentAttempts.length >= options.maxAttempts) {
      throw new Error(
        `Fraud Velocity Block (429): Too many payment attempts for '${identifier}' within ${options.windowMs / 1000}s window.`
      );
    }

    recentAttempts.push(nowMs);
    this.attemptsStore.set(identifier, recentAttempts);
  }
}

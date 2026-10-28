export type OutboxDeliveryStatus = "PENDING" | "PUBLISHED" | "DEAD_LETTER";

export interface OutboxEventRecord {
  readonly eventId: string;
  readonly aggregateId: string;
  readonly eventType: string;
  readonly payloadJson: string;
  readonly attemptCount: number;
  readonly maxAttempts: number;
  readonly nextAttemptAtMs: number;
  readonly status: OutboxDeliveryStatus;
}

export function computeExponentialBackoffWithJitter(
  attempt: number,
  baseDelayMs: number = 1000,
  maxDelayMs: number = 300_000,
  deterministicJitterRatio: number = 0.25
): number {
  const safeAttempt = Math.max(1, Math.min(attempt, 20));
  const exponential = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, safeAttempt - 1));
  const boundedRatio = Math.max(0, Math.min(1, deterministicJitterRatio));
  const jitterOffset = Math.floor(exponential * 0.2 * boundedRatio);
  return Math.min(maxDelayMs, exponential + jitterOffset);
}

export function transitionOutboxRecordOnFailure(
  record: OutboxEventRecord,
  nowMs: number,
  baseDelayMs: number = 1000
): OutboxEventRecord {
  const nextAttemptCount = record.attemptCount + 1;

  if (nextAttemptCount >= record.maxAttempts) {
    return {
      ...record,
      attemptCount: nextAttemptCount,
      status: "DEAD_LETTER",
    };
  }

  const delayMs = computeExponentialBackoffWithJitter(nextAttemptCount, baseDelayMs);
  return {
    ...record,
    attemptCount: nextAttemptCount,
    nextAttemptAtMs: nowMs + delayMs,
    status: "PENDING",
  };
}

export function transitionOutboxRecordOnSuccess(record: OutboxEventRecord): OutboxEventRecord {
  return {
    ...record,
    attemptCount: record.attemptCount + 1,
    status: "PUBLISHED",
  };
}

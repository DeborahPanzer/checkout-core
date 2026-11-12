/**
 * ISO-8583 Data Element 39 (DE39) Response Mapper & Smart Retry Classifier.
 *
 * Enforces Visa & Mastercard retry compliance mandates by strictly separating
 * terminal Hard Declines / Security Blocks (which incur scheme retry penalties
 * if re-submitted) from transient Soft Declines and Issuer Outages.
 */

export type DeclineCategory =
  | 'APPROVED'
  | 'SOFT_DECLINE'
  | 'HARD_DECLINE'
  | 'SECURITY_BLOCK';

export type RetryDirective =
  | 'NONE'
  | 'IMMEDIATE_FAILOVER'
  | 'BACKOFF_RETRY'
  | 'DO_NOT_RETRY';

export interface Iso8583Classification {
  readonly de39Code: string;
  readonly normalizedReason: string;
  readonly category: DeclineCategory;
  readonly retryDirective: RetryDirective;
  readonly baseCooldownMs: number;
  readonly triggerAcquirerCircuitPenalty: boolean;
  readonly schemeRetryFeeRisk: boolean;
}

export interface RetryEligibilityResult {
  readonly eligible: boolean;
  readonly nextDelayMs: number;
  readonly switchAcquirerRail: boolean;
  readonly classification: Iso8583Classification;
  readonly rejectionGuardReason: string | null;
}

type ClassificationEntry = Omit<Iso8583Classification, 'de39Code'>;

const MAX_BACKOFF_CEILING_MS = 86_400_000; // 24 hours

const DE39_CLASSIFICATION_TABLE: Readonly<Record<string, ClassificationEntry>> = {
  '00': {
    normalizedReason: 'APPROVED_OR_COMPLETED_SUCCESSFULLY',
    category: 'APPROVED',
    retryDirective: 'NONE',
    baseCooldownMs: 0,
    triggerAcquirerCircuitPenalty: false,
    schemeRetryFeeRisk: false,
  },
  '05': {
    normalizedReason: 'DO_NOT_HONOR_GENERIC_ISSUER_DECLINE',
    category: 'SOFT_DECLINE',
    retryDirective: 'BACKOFF_RETRY',
    baseCooldownMs: 30_000,
    triggerAcquirerCircuitPenalty: false,
    schemeRetryFeeRisk: false,
  },
  '12': {
    normalizedReason: 'INVALID_TRANSACTION_TYPE',
    category: 'HARD_DECLINE',
    retryDirective: 'DO_NOT_RETRY',
    baseCooldownMs: 0,
    triggerAcquirerCircuitPenalty: false,
    schemeRetryFeeRisk: true,
  },
  '14': {
    normalizedReason: 'INVALID_CARD_NUMBER_NO_SUCH_PAN',
    category: 'HARD_DECLINE',
    retryDirective: 'DO_NOT_RETRY',
    baseCooldownMs: 0,
    triggerAcquirerCircuitPenalty: false,
    schemeRetryFeeRisk: true,
  },
  '41': {
    normalizedReason: 'LOST_CARD_PICK_UP',
    category: 'SECURITY_BLOCK',
    retryDirective: 'DO_NOT_RETRY',
    baseCooldownMs: 0,
    triggerAcquirerCircuitPenalty: false,
    schemeRetryFeeRisk: true,
  },
  '43': {
    normalizedReason: 'STOLEN_CARD_PICK_UP',
    category: 'SECURITY_BLOCK',
    retryDirective: 'DO_NOT_RETRY',
    baseCooldownMs: 0,
    triggerAcquirerCircuitPenalty: false,
    schemeRetryFeeRisk: true,
  },
  '51': {
    normalizedReason: 'INSUFFICIENT_FUNDS_OR_OVER_CREDIT_LIMIT',
    category: 'SOFT_DECLINE',
    retryDirective: 'BACKOFF_RETRY',
    baseCooldownMs: 3_600_000,
    triggerAcquirerCircuitPenalty: false,
    schemeRetryFeeRisk: false,
  },
  '54': {
    normalizedReason: 'EXPIRED_CARD',
    category: 'HARD_DECLINE',
    retryDirective: 'DO_NOT_RETRY',
    baseCooldownMs: 0,
    triggerAcquirerCircuitPenalty: false,
    schemeRetryFeeRisk: true,
  },
  '57': {
    normalizedReason: 'TRANSACTION_NOT_PERMITTED_TO_CARDHOLDER',
    category: 'HARD_DECLINE',
    retryDirective: 'DO_NOT_RETRY',
    baseCooldownMs: 0,
    triggerAcquirerCircuitPenalty: false,
    schemeRetryFeeRisk: true,
  },
  '59': {
    normalizedReason: 'SUSPECTED_FRAUD_ISSUER_RISK_BLOCK',
    category: 'SECURITY_BLOCK',
    retryDirective: 'DO_NOT_RETRY',
    baseCooldownMs: 0,
    triggerAcquirerCircuitPenalty: false,
    schemeRetryFeeRisk: true,
  },
  '61': {
    normalizedReason: 'EXCEEDS_WITHDRAWAL_AMOUNT_LIMIT',
    category: 'SOFT_DECLINE',
    retryDirective: 'BACKOFF_RETRY',
    baseCooldownMs: 900_000,
    triggerAcquirerCircuitPenalty: false,
    schemeRetryFeeRisk: false,
  },
  '65': {
    normalizedReason: 'ACTIVITY_COUNT_LIMIT_EXCEEDED_OR_SCA_CHALLENGE',
    category: 'SOFT_DECLINE',
    retryDirective: 'BACKOFF_RETRY',
    baseCooldownMs: 300_000,
    triggerAcquirerCircuitPenalty: false,
    schemeRetryFeeRisk: false,
  },
  '91': {
    normalizedReason: 'ISSUER_OR_SWITCH_INOPERATIVE',
    category: 'SOFT_DECLINE',
    retryDirective: 'IMMEDIATE_FAILOVER',
    baseCooldownMs: 1_000,
    triggerAcquirerCircuitPenalty: true,
    schemeRetryFeeRisk: false,
  },
  '96': {
    normalizedReason: 'SYSTEM_MALFUNCTION_NETWORK_TIMEOUT',
    category: 'SOFT_DECLINE',
    retryDirective: 'IMMEDIATE_FAILOVER',
    baseCooldownMs: 2_000,
    triggerAcquirerCircuitPenalty: true,
    schemeRetryFeeRisk: false,
  },
};

const UNKNOWN_CODE_FALLBACK: ClassificationEntry = {
  normalizedReason: 'UNMAPPED_CONSERVATIVE_HARD_DECLINE',
  category: 'HARD_DECLINE',
  retryDirective: 'DO_NOT_RETRY',
  baseCooldownMs: 0,
  triggerAcquirerCircuitPenalty: false,
  schemeRetryFeeRisk: true,
};

/**
 * Classifies a 2-character alphanumeric ISO-8583 DE39 response code.
 */
export function classifyIso8583Response(rawDe39Code: string): Iso8583Classification {
  const normalized = rawDe39Code.trim().toUpperCase();
  if (!/^[0-9A-Z]{2}$/.test(normalized)) {
    throw new RangeError(
      `Invalid ISO-8583 DE39 response code "${rawDe39Code}": expected 2 alphanumeric characters.`
    );
  }

  const mapped = DE39_CLASSIFICATION_TABLE[normalized];
  if (mapped !== undefined) {
    return {
      de39Code: normalized,
      ...mapped,
    };
  }

  return {
    de39Code: normalized,
    ...UNKNOWN_CODE_FALLBACK,
  };
}

/**
 * Computes deterministic retry eligibility and exponential cooldown delay.
 */
export function evaluateRetryEligibility(
  rawDe39Code: string,
  attemptNumber: number,
  maxSoftRetries: number = 3
): RetryEligibilityResult {
  if (!Number.isInteger(attemptNumber) || attemptNumber < 1) {
    throw new RangeError('attemptNumber must be a positive integer >= 1.');
  }
  if (!Number.isInteger(maxSoftRetries) || maxSoftRetries < 0) {
    throw new RangeError('maxSoftRetries must be a non-negative integer.');
  }

  const classification = classifyIso8583Response(rawDe39Code);

  if (classification.category === 'APPROVED') {
    return {
      eligible: false,
      nextDelayMs: 0,
      switchAcquirerRail: false,
      classification,
      rejectionGuardReason: 'ALREADY_APPROVED',
    };
  }

  if (
    classification.category === 'HARD_DECLINE' ||
    classification.category === 'SECURITY_BLOCK' ||
    classification.retryDirective === 'DO_NOT_RETRY'
  ) {
    return {
      eligible: false,
      nextDelayMs: 0,
      switchAcquirerRail: false,
      classification,
      rejectionGuardReason: 'TERMINAL_SCHEME_DECLINE_NO_RETRY',
    };
  }

  if (attemptNumber > maxSoftRetries) {
    return {
      eligible: false,
      nextDelayMs: 0,
      switchAcquirerRail: false,
      classification,
      rejectionGuardReason: 'MAX_SOFT_RETRY_BUDGET_EXHAUSTED',
    };
  }

  const rawBackoffMs = classification.baseCooldownMs * 2 ** (attemptNumber - 1);
  const boundedDelayMs = Math.min(rawBackoffMs, MAX_BACKOFF_CEILING_MS);

  return {
    eligible: true,
    nextDelayMs: boundedDelayMs,
    switchAcquirerRail: classification.retryDirective === 'IMMEDIATE_FAILOVER',
    classification,
    rejectionGuardReason: null,
  };
}

export type ReconciliationDiscrepancyType =
  | "MATCHED_EXACT"
  | "MISSING_PROCESSOR_CAPTURE"
  | "MISSING_BANK_SETTLEMENT"
  | "AMOUNT_MISMATCH"
  | "FEE_DRIFT_DETECTED";

export interface InternalIntentEntry {
  readonly intentId: string;
  readonly expectedGrossMinor: bigint;
  readonly expectedFeeMinor: bigint;
}

export interface ProcessorCaptureEntry {
  readonly intentId: string;
  readonly capturedGrossMinor: bigint;
}

export interface BankClearingEntry {
  readonly intentId: string;
  readonly settledGrossMinor: bigint;
  readonly deductedFeeMinor: bigint;
}

export interface ThreeWayReconciliationResult {
  readonly intentId: string;
  readonly status: ReconciliationDiscrepancyType;
  readonly varianceMinor: bigint;
}

export function reconcileThreeWaySettlement(
  internal: InternalIntentEntry,
  processor?: ProcessorCaptureEntry,
  bank?: BankClearingEntry
): ThreeWayReconciliationResult {
  if (!processor) {
    return {
      intentId: internal.intentId,
      status: "MISSING_PROCESSOR_CAPTURE",
      varianceMinor: internal.expectedGrossMinor,
    };
  }

  if (!bank) {
    return {
      intentId: internal.intentId,
      status: "MISSING_BANK_SETTLEMENT",
      varianceMinor: processor.capturedGrossMinor,
    };
  }

  if (
    internal.expectedGrossMinor !== processor.capturedGrossMinor ||
    processor.capturedGrossMinor !== bank.settledGrossMinor
  ) {
    return {
      intentId: internal.intentId,
      status: "AMOUNT_MISMATCH",
      varianceMinor: internal.expectedGrossMinor - bank.settledGrossMinor,
    };
  }

  if (internal.expectedFeeMinor !== bank.deductedFeeMinor) {
    return {
      intentId: internal.intentId,
      status: "FEE_DRIFT_DETECTED",
      varianceMinor: bank.deductedFeeMinor - internal.expectedFeeMinor,
    };
  }

  return {
    intentId: internal.intentId,
    status: "MATCHED_EXACT",
    varianceMinor: 0n,
  };
}

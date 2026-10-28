export type CardFundingSource = "CREDIT" | "DEBIT" | "PREPAID" | "COMMERCIAL_CORPORATE";

export interface InterchangeFeeSchedule {
  readonly interchangeBps: number;       // Issuer interchange in basis points (100 bps = 1.00%)
  readonly interchangeFixedMinor: bigint; // Fixed issuer fee in minor units (e.g., cents)
  readonly schemeFeeBps: number;         // Card network assessment fee (Visa/Mastercard)
  readonly acquirerMarkupBps: number;    // Processor margin in basis points
  readonly acquirerFixedMinor: bigint;   // Processor fixed per-transaction fee
}

export interface InterchangePlusBreakdown {
  readonly grossAmountMinor: bigint;
  readonly issuerInterchangeMinor: bigint;
  readonly cardSchemeAssessmentMinor: bigint;
  readonly acquirerMarkupMinor: bigint;
  readonly totalFeeMinor: bigint;
  readonly netMerchantSettlementMinor: bigint;
}

export function resolveStandardInterchangeSchedule(
  funding: CardFundingSource,
  isCrossBorder: boolean,
  isCardPresent: boolean
): InterchangeFeeSchedule {
  const crossBorderBps = isCrossBorder ? 45 : 0;
  const cnpBps = isCardPresent ? 0 : 30;

  switch (funding) {
    case "DEBIT":
      return {
        interchangeBps: 20 + cnpBps,
        interchangeFixedMinor: 21n, // US Durbin-regulated cap baseline (21 cents + 5 bps)
        schemeFeeBps: 13 + crossBorderBps,
        acquirerMarkupBps: 10,
        acquirerFixedMinor: 5n,
      };
    case "COMMERCIAL_CORPORATE":
      return {
        interchangeBps: 250 + cnpBps,
        interchangeFixedMinor: 10n,
        schemeFeeBps: 15 + crossBorderBps,
        acquirerMarkupBps: 15,
        acquirerFixedMinor: 10n,
      };
    case "PREPAID":
      return {
        interchangeBps: 115 + cnpBps,
        interchangeFixedMinor: 15n,
        schemeFeeBps: 13 + crossBorderBps,
        acquirerMarkupBps: 12,
        acquirerFixedMinor: 8n,
      };
    case "CREDIT":
    default:
      return {
        interchangeBps: 180 + cnpBps,
        interchangeFixedMinor: 10n,
        schemeFeeBps: 14 + crossBorderBps,
        acquirerMarkupBps: 12,
        acquirerFixedMinor: 8n,
      };
  }
}

export function computeInterchangePlusSettlement(
  grossAmountMinor: bigint,
  schedule: InterchangeFeeSchedule
): InterchangePlusBreakdown {
  if (grossAmountMinor <= 0n) {
    throw new Error("IC_PLUS_ERR: Gross transaction amount must be strictly positive");
  }

  const bpsDivisor = 10_000n;

  const issuerVariable = (grossAmountMinor * BigInt(schedule.interchangeBps) + 5_000n) / bpsDivisor;
  const issuerInterchangeMinor = issuerVariable + schedule.interchangeFixedMinor;

  const cardSchemeAssessmentMinor =
    (grossAmountMinor * BigInt(schedule.schemeFeeBps) + 5_000n) / bpsDivisor;

  const acquirerVariable = (grossAmountMinor * BigInt(schedule.acquirerMarkupBps) + 5_000n) / bpsDivisor;
  const acquirerMarkupMinor = acquirerVariable + schedule.acquirerFixedMinor;

  const totalFeeMinor =
    issuerInterchangeMinor + cardSchemeAssessmentMinor + acquirerMarkupMinor;

  return {
    grossAmountMinor,
    issuerInterchangeMinor,
    cardSchemeAssessmentMinor,
    acquirerMarkupMinor,
    totalFeeMinor,
    netMerchantSettlementMinor: grossAmountMinor - totalFeeMinor,
  };
}

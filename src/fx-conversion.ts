export interface FxQuoteSpec {
  readonly sourceCurrency: string;
  readonly targetCurrency: string;
  readonly midMarketRateScaled: bigint; // Scaled by 10^8 for deterministic integer math
  readonly spreadBasisPoints: number;   // e.g., 150 bps = 1.50%
}

export interface FxConversionResult {
  readonly sourceAmountMinor: bigint;
  readonly targetAmountMinor: bigint;
  readonly effectiveRateScaled: bigint;
  readonly feeTargetMinor: bigint;
}

const ISO4217_EXPONENTS: Readonly<Record<string, number>> = {
  USD: 2,
  EUR: 2,
  GBP: 2,
  CAD: 2,
  SGD: 2,
  AUD: 2,
  JPY: 0,
  KRW: 0,
  VND: 0,
  KWD: 3,
  BHD: 3,
  OMR: 3,
};

export function getCurrencyExponent(currency: string): number {
  const code = currency.toUpperCase();
  const exp = ISO4217_EXPONENTS[code];
  if (exp === undefined) {
    throw new Error(`FX_ERR: Unsupported ISO-4217 currency code ${code}`);
  }
  return exp;
}

/**
 * Deterministic Banker's Rounding (Round Half to Even) on BigInt division.
 */
export function divideRoundHalfToEven(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) {
    throw new Error("FX_ERR: Denominator must be strictly positive");
  }
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  const doubleRemainder = remainder * 2n;

  if (doubleRemainder > denominator) {
    return quotient + 1n;
  }
  if (doubleRemainder < denominator) {
    return quotient;
  }
  return quotient % 2n === 0n ? quotient : quotient + 1n;
}

export function convertCurrencyMinorUnits(
  sourceAmountMinor: bigint,
  quote: FxQuoteSpec
): FxConversionResult {
  if (sourceAmountMinor <= 0n) {
    throw new Error("FX_ERR: Source minor unit amount must be positive");
  }

  const srcExp = getCurrencyExponent(quote.sourceCurrency);
  const dstExp = getCurrencyExponent(quote.targetCurrency);

  const scaleFactor = 100_000_000n; // 10^8
  const bpsDenominator = 10_000n;
  const spreadMultiplier = bpsDenominator - BigInt(quote.spreadBasisPoints);

  const effectiveRateScaled = divideRoundHalfToEven(
    quote.midMarketRateScaled * spreadMultiplier,
    bpsDenominator
  );

  const expDiff = dstExp - srcExp;
  let adjustedNumerator = sourceAmountMinor * effectiveRateScaled;
  let adjustedDenominator = scaleFactor;

  if (expDiff > 0) {
    adjustedNumerator *= 10n ** BigInt(expDiff);
  } else if (expDiff < 0) {
    adjustedDenominator *= 10n ** BigInt(-expDiff);
  }

  const rawTargetMinor = divideRoundHalfToEven(
    sourceAmountMinor * quote.midMarketRateScaled * (expDiff > 0 ? 10n ** BigInt(expDiff) : 1n),
    scaleFactor * (expDiff < 0 ? 10n ** BigInt(-expDiff) : 1n)
  );

  const netTargetMinor = divideRoundHalfToEven(adjustedNumerator, adjustedDenominator);

  return {
    sourceAmountMinor,
    targetAmountMinor: netTargetMinor,
    effectiveRateScaled,
    feeTargetMinor: rawTargetMinor - netTargetMinor,
  };
}

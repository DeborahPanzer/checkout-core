export interface SettlementBreakdown {
  grossAmountMinor: number;
  interchangeFeeMinor: number;
  gatewayMarkupMinor: number;
  totalFeeMinor: number;
  netPayoutMinor: number;
  currency: string;
}

/**
 * SettlementEngine computes merchant net payouts and processor fee splits.
 */
export class MerchantSettlementEngine {
  // Standard interchange + markup simulation (e.g., 2.9% + 30 minor units)
  private readonly variableRate: number;
  private readonly fixedMarkupMinor: number;

  constructor(variableRate = 0.029, fixedMarkupMinor = 30) {
    this.variableRate = variableRate;
    this.fixedMarkupMinor = fixedMarkupMinor;
  }

  public calculateSettlement(grossAmountMinor: number, currency = 'USD'): SettlementBreakdown {
    if (!Number.isInteger(grossAmountMinor) || grossAmountMinor <= 0) {
      throw new Error('Settlement Violation: Gross amount must be a positive integer minor unit.');
    }

    const interchangeFeeMinor = Math.round(grossAmountMinor * this.variableRate);
    const gatewayMarkupMinor = this.fixedMarkupMinor;
    const totalFeeMinor = interchangeFeeMinor + gatewayMarkupMinor;
    const netPayoutMinor = Math.max(0, grossAmountMinor - totalFeeMinor);

    return {
      grossAmountMinor,
      interchangeFeeMinor,
      gatewayMarkupMinor,
      totalFeeMinor,
      netPayoutMinor,
      currency,
    };
  }
}

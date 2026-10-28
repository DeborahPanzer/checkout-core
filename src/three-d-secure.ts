export type ThreeDSFlowDecision = "FRICTIONLESS" | "CHALLENGE_REQUIRED" | "EXEMPT_LOW_VALUE" | "EXEMPT_TRA";

export interface ThreeDSAssessmentInput {
  readonly amountMinorUnits: number;
  readonly currency: string;
  readonly issuerCountryIso2: string;
  readonly merchantFraudRateBps: number; // Basis points (e.g., 10 bps = 0.10%)
  readonly deviceChannel: "BROWSER" | "APP" | "MERCHANT_INITIATED";
  readonly isRecurringMIT: boolean;
  readonly avsPostalMatch: boolean;
}

export interface ThreeDSRoutingDirective {
  readonly decision: ThreeDSFlowDecision;
  readonly exemptionIndicator: "NONE" | "LOW_VALUE" | "TRANSACTION_RISK_ANALYSIS" | "MIT_RECURRING";
  readonly challengeIndicator: "01_NO_PREFERENCE" | "02_NO_CHALLENGE" | "04_MANDATE_CHALLENGE";
  readonly computedRiskScore: number;
}

const EEA_COUNTRIES = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE",
  "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT",
  "RO", "SK", "SI", "ES", "SE", "IS", "LI", "NO", "GB",
]);

export function evaluateThreeDSecurePolicy(input: ThreeDSAssessmentInput): ThreeDSRoutingDirective {
  if (input.isRecurringMIT && input.deviceChannel === "MERCHANT_INITIATED") {
    return {
      decision: "FRICTIONLESS",
      exemptionIndicator: "MIT_RECURRING",
      challengeIndicator: "02_NO_CHALLENGE",
      computedRiskScore: 5,
    };
  }

  let riskScore = 10;
  if (!input.avsPostalMatch) riskScore += 35;
  if (input.amountMinorUnits > 50000) riskScore += 25;
  if (input.merchantFraudRateBps > 13) riskScore += 30;

  const isRegulatedScaRegion = EEA_COUNTRIES.has(input.issuerCountryIso2.toUpperCase());

  if (isRegulatedScaRegion && input.amountMinorUnits <= 3000 && riskScore < 40) {
    return {
      decision: "EXEMPT_LOW_VALUE",
      exemptionIndicator: "LOW_VALUE",
      challengeIndicator: "02_NO_CHALLENGE",
      computedRiskScore: riskScore,
    };
  }

  if (input.merchantFraudRateBps <= 13 && input.amountMinorUnits <= 10000 && riskScore < 35) {
    return {
      decision: "EXEMPT_TRA",
      exemptionIndicator: "TRANSACTION_RISK_ANALYSIS",
      challengeIndicator: "02_NO_CHALLENGE",
      computedRiskScore: riskScore,
    };
  }

  if (riskScore >= 50) {
    return {
      decision: "CHALLENGE_REQUIRED",
      exemptionIndicator: "NONE",
      challengeIndicator: "04_MANDATE_CHALLENGE",
      computedRiskScore: riskScore,
    };
  }

  return {
    decision: "FRICTIONLESS",
    exemptionIndicator: "NONE",
    challengeIndicator: "01_NO_PREFERENCE",
    computedRiskScore: riskScore,
  };
}

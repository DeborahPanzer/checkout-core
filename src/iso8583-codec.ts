export type DeclineCategory = "APPROVED" | "SOFT_DECLINE_RETRYABLE" | "HARD_DECLINE_TERMINAL" | "SECURITY_BLOCK";

export interface Iso8583Disposition {
  readonly responseCode: string;
  readonly category: DeclineCategory;
  readonly description: string;
  readonly allowAutomatedRetry: boolean;
  readonly recommendedBackoffMs: number;
}

const ISO8583_DISPOSITION_TABLE: Readonly<Record<string, Omit<Iso8583Disposition, "responseCode">>> = {
  "00": {
    category: "APPROVED",
    description: "Approved or completed_successfully",
    allowAutomatedRetry: false,
    recommendedBackoffMs: 0,
  },
  "05": {
    category: "SOFT_DECLINE_RETRYABLE",
    description: "Do not honor (generic issuer soft decline)",
    allowAutomatedRetry: true,
    recommendedBackoffMs: 30000,
  },
  "14": {
    category: "HARD_DECLINE_TERMINAL",
    description: "Invalid card number (no such number)",
    allowAutomatedRetry: false,
    recommendedBackoffMs: 0,
  },
  "41": {
    category: "SECURITY_BLOCK",
    description: "Lost card — pick up (fraud block)",
    allowAutomatedRetry: false,
    recommendedBackoffMs: 0,
  },
  "43": {
    category: "SECURITY_BLOCK",
    description: "Stolen card — pick up (fraud block)",
    allowAutomatedRetry: false,
    recommendedBackoffMs: 0,
  },
  "51": {
    category: "SOFT_DECLINE_RETRYABLE",
    description: "Insufficient funds",
    allowAutomatedRetry: true,
    recommendedBackoffMs: 86400000,
  },
  "54": {
    category: "HARD_DECLINE_TERMINAL",
    description: "Expired card",
    allowAutomatedRetry: false,
    recommendedBackoffMs: 0,
  },
  "91": {
    category: "SOFT_DECLINE_RETRYABLE",
    description: "Issuer or switch is inoperative",
    allowAutomatedRetry: true,
    recommendedBackoffMs: 5000,
  },
  "96": {
    category: "SOFT_DECLINE_RETRYABLE",
    description: "System malfunction / network timeout",
    allowAutomatedRetry: true,
    recommendedBackoffMs: 2000,
  },
};

export function classifyIso8583ResponseCode(rawCode: string): Iso8583Disposition {
  const normalized = rawCode.trim().padStart(2, "0");
  const entry = ISO8583_DISPOSITION_TABLE[normalized];

  if (!entry) {
    return {
      responseCode: normalized,
      category: "HARD_DECLINE_TERMINAL",
      description: "Unmapped acquirer response code — defaulting to non-retryable terminal decline",
      allowAutomatedRetry: false,
      recommendedBackoffMs: 0,
    };
  }

  return {
    responseCode: normalized,
    ...entry,
  };
}

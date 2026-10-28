import * as crypto from "crypto";

export type TokenRequestorWallet = "APPLE_PAY" | "GOOGLE_PAY" | "NETWORK_COF";

export interface NetworkTokenPayload {
  readonly dpan: string; // Device/Network Token Primary Account Number
  readonly tokenExpMonth: number;
  readonly tokenExpYear: number;
  readonly cryptogramBase64: string;
  readonly eciIndicator: "05" | "06" | "07";
  readonly walletType: TokenRequestorWallet;
  readonly transactionAmountMinor: bigint;
  readonly currencyCode: string;
}

export interface CryptogramValidationResult {
  readonly valid: boolean;
  readonly liabilityShiftEligible: boolean;
  readonly cryptogramDigestHex: string;
  readonly rejectionReason?: string;
}

export function validateNetworkTokenCryptogram(
  payload: NetworkTokenPayload,
  acquirerSharedSecret: Buffer,
  currentYear: number
): CryptogramValidationResult {
  if (payload.tokenExpYear < currentYear) {
    return {
      valid: false,
      liabilityShiftEligible: false,
      cryptogramDigestHex: "",
      rejectionReason: "NETWORK_TOKEN_EXPIRED",
    };
  }

  if (payload.tokenExpMonth < 1 || payload.tokenExpMonth > 12) {
    return {
      valid: false,
      liabilityShiftEligible: false,
      cryptogramDigestHex: "",
      rejectionReason: "INVALID_TOKEN_EXPIRY_MONTH",
    };
  }

  const decodedCryptogram = Buffer.from(payload.cryptogramBase64, "base64");
  if (decodedCryptogram.length < 20) {
    return {
      valid: false,
      liabilityShiftEligible: false,
      cryptogramDigestHex: "",
      rejectionReason: "MALFORMED_TAVV_CRYPTOGRAM_LENGTH",
    };
  }

  const digest = crypto
    .createHmac("sha256", acquirerSharedSecret)
    .update(decodedCryptogram)
    .update(`${payload.dpan}:${payload.transactionAmountMinor.toString()}:${payload.currencyCode}`)
    .digest("hex");

  return {
    valid: true,
    liabilityShiftEligible: payload.eciIndicator === "05",
    cryptogramDigestHex: digest,
  };
}

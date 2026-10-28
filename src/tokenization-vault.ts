import * as crypto from "crypto";

export type CardNetwork = "VISA" | "MASTERCARD" | "AMEX" | "DISCOVER" | "UNKNOWN";

export interface TokenizedCardVaultRecord {
  readonly tokenId: string;
  readonly network: CardNetwork;
  readonly binPrefix: string;
  readonly last4: string;
  readonly ciphertextHex: string;
  readonly ivHex: string;
  readonly authTagHex: string;
  readonly fingerprintSha256: string;
}

export function verifyLuhnChecksum(rawPan: string): boolean {
  const digits = rawPan.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) {
    return false;
  }

  let sum = 0;
  let shouldDouble = false;

  for (let i = digits.length - 1; i >= 0; i--) {
    const charCode = digits.charCodeAt(i) - 48;
    let digit = charCode;

    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
}

export function detectCardNetwork(cleanPan: string): CardNetwork {
  if (/^4\d{12}(\d{3})?(\d{3})?$/.test(cleanPan)) return "VISA";
  if (/^(5[1-5]\d{4}|2(22[1-9]|2[3-9]\d|[3-6]\d{2}|7[01]\d|720)\d{2})\d{10}$/.test(cleanPan)) {
    return "MASTERCARD";
  }
  if (/^3[47]\d{13}$/.test(cleanPan)) return "AMEX";
  if (/^6(?:011|5\d{2})\d{12}$/.test(cleanPan)) return "DISCOVER";
  return "UNKNOWN";
}

export function tokenizePrimaryAccountNumber(
  rawPan: string,
  masterKey32Bytes: Buffer
): TokenizedCardVaultRecord {
  const cleanPan = rawPan.replace(/\D/g, "");
  if (!verifyLuhnChecksum(cleanPan)) {
    throw new Error("PCI_VAULT_ERR: Primary Account Number failed ISO/IEC 7812 Luhn check");
  }
  if (masterKey32Bytes.length !== 32) {
    throw new Error("PCI_VAULT_ERR: AES-256-GCM requires an exact 32-byte key");
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", masterKey32Bytes, iv);
  const encrypted = Buffer.concat([cipher.update(cleanPan, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const fingerprint = crypto
    .createHmac("sha256", masterKey32Bytes)
    .update(cleanPan)
    .digest("hex");

  return {
    tokenId: `tok_${crypto.randomBytes(12).toString("hex")}`,
    network: detectCardNetwork(cleanPan),
    binPrefix: cleanPan.slice(0, 6),
    last4: cleanPan.slice(-4),
    ciphertextHex: encrypted.toString("hex"),
    ivHex: iv.toString("hex"),
    authTagHex: authTag.toString("hex"),
    fingerprintSha256: fingerprint,
  };
}

import * as crypto from 'crypto';

export interface TokenizedCardResult {
  cardToken: string;
  maskedPan: string;
  brand: string;
  expiryMonth: number;
  expiryYear: number;
}

export class TokenizationVault {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private readonly vaultStorage = new Map<string, string>();
  private readonly encryptionKey: Buffer;

  constructor(masterKeyHex?: string) {
    // 32-byte key for AES-256
    const defaultHex = 'a'.repeat(64);
    this.encryptionKey = Buffer.from(masterKeyHex ?? defaultHex, 'hex');
  }

  public tokenize(pan: string, expiryMonth: number, expiryYear: number, cvv: string): TokenizedCardResult {
    const sanitizedPan = pan.replace(/\D/g, '');
    if (sanitizedPan.length < 13 || sanitizedPan.length > 19) {
      throw new Error('Tokenization Violation: Invalid Primary Account Number (PAN) length.');
    }

    const brand = this.detectBrand(sanitizedPan);
    const maskedPan = `****-****-****-${sanitizedPan.slice(-4)}`;
    const cardToken = `tok_${crypto.randomBytes(12).toString('hex')}`;

    // Encrypt sensitive payload (PAN + CVV) using AES-256-GCM
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(TokenizationVault.ALGORITHM, this.encryptionKey, iv);
    const sensitiveData = JSON.stringify({ pan: sanitizedPan, cvv });

    const encrypted = Buffer.concat([cipher.update(sensitiveData, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    // Store encrypted bundle in vault
    const vaultPayload = Buffer.concat([iv, tag, encrypted]).toString('base64');
    this.vaultStorage.set(cardToken, vaultPayload);

    return {
      cardToken,
      maskedPan,
      brand,
      expiryMonth,
      expiryYear,
    };
  }

  private detectBrand(pan: string): string {
    if (/^4/.test(pan)) return 'VISA';
    if (/^5[1-5]/.test(pan) || /^2[2-7]/.test(pan)) return 'MASTERCARD';
    if (/^3[47]/.test(pan)) return 'AMEX';
    return 'UNKNOWN';
  }
}

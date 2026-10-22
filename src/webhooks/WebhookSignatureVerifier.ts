import * as crypto from 'crypto';

export interface VerifiedWebhookEvent<T = Record<string, unknown>> {
  id: string;
  type: string;
  timestamp: number;
  signatureValid: true;
  data: T;
}

/**
 * Constant-time HMAC-SHA256 webhook signature verifier with replay-window protection.
 * Mirrors Stripe/Adyen v1 cryptographic signing schemes (`t=timestamp,v1=hmac`).
 */
export class WebhookSignatureVerifier {
  private static readonly DEFAULT_TOLERANCE_SECONDS = 300;
  private readonly processedEventIds = new Set<string>();

  public verifyAndParse<T = Record<string, unknown>>(
    rawPayload: string,
    signatureHeader: string,
    endpointSecret: string,
    toleranceSeconds = WebhookSignatureVerifier.DEFAULT_TOLERANCE_SECONDS,
    nowUnixSeconds = Math.floor(Date.now() / 1000)
  ): VerifiedWebhookEvent<T> {
    if (!rawPayload || !signatureHeader || !endpointSecret) {
      throw new Error('Webhook Security Violation: Missing payload, signature header, or secret.');
    }

    const parsedHeader = this.parseHeader(signatureHeader);
    const ageSeconds = Math.abs(nowUnixSeconds - parsedHeader.timestamp);

    if (ageSeconds > toleranceSeconds) {
      throw new Error(
        `Webhook Replay Rejected: Timestamp drift (${ageSeconds}s) exceeds ${toleranceSeconds}s tolerance.`
      );
    }

    const signedPayload = `${parsedHeader.timestamp}.${rawPayload}`;
    const expectedHex = crypto
      .createHmac('sha256', endpointSecret)
      .update(signedPayload, 'utf8')
      .digest('hex');

    if (!this.constantTimeHexEquals(expectedHex, parsedHeader.v1Signature)) {
      throw new Error('Webhook Cryptographic Failure: HMAC-SHA256 signature mismatch.');
    }

    const parsedBody = JSON.parse(rawPayload) as { id?: string; type?: string; data?: T };
    if (!parsedBody.id || !parsedBody.type) {
      throw new Error('Webhook Schema Violation: Event payload must contain id and type.');
    }

    if (this.processedEventIds.has(parsedBody.id)) {
      throw new Error(`Webhook Idempotency Guard: Duplicate event '${parsedBody.id}' suppressed.`);
    }

    this.processedEventIds.add(parsedBody.id);

    return {
      id: parsedBody.id,
      type: parsedBody.type,
      timestamp: parsedHeader.timestamp,
      signatureValid: true,
      data: (parsedBody.data ?? {}) as T,
    };
  }

  public static signPayloadForTesting(
    rawPayload: string,
    secret: string,
    timestamp = Math.floor(Date.now() / 1000)
  ): string {
    const mac = crypto
      .createHmac('sha256', secret)
      .update(`${timestamp}.${rawPayload}`, 'utf8')
      .digest('hex');
    return `t=${timestamp},v1=${mac}`;
  }

  private parseHeader(header: string): { timestamp: number; v1Signature: string } {
    const parts = header.split(',').map((part) => part.trim());
    let timestamp = NaN;
    let v1Signature = '';

    for (const part of parts) {
      const [key, value] = part.split('=');
      if (key === 't' && value) {
        timestamp = Number.parseInt(value, 10);
      } else if (key === 'v1' && value) {
        v1Signature = value;
      }
    }

    if (!Number.isFinite(timestamp) || !/^[a-f0-9]{64}$/i.test(v1Signature)) {
      throw new Error('Webhook Header Malformed: Expected format t=<unix_ts>,v1=<64_byte_hex_hmac>.');
    }

    return { timestamp, v1Signature: v1Signature.toLowerCase() };
  }

  private constantTimeHexEquals(expectedHex: string, candidateHex: string): boolean {
    const a = Buffer.from(expectedHex, 'hex');
    const b = Buffer.from(candidateHex, 'hex');
    if (a.length !== b.length) {
      return false;
    }
    return crypto.timingSafeEqual(a, b);
  }
}

import * as crypto from 'crypto';
import { CheckoutRequestPayload, CheckoutSessionResponse } from '../types/checkout.types';

interface IdempotencyRecord {
  status: 'IN_PROGRESS' | 'COMPLETED';
  payloadHash: string;
  response?: CheckoutSessionResponse;
  createdAt: number;
}

export class IdempotencyEngine {
  private readonly store = new Map<string, IdempotencyRecord>();

  public computeFingerprint(payload: CheckoutRequestPayload): string {
    const canonical = JSON.stringify({
      email: payload.customer.email.trim().toLowerCase(),
      items: [...payload.items]
        .map((i) => ({ productId: i.productId, quantity: i.quantity }))
        .sort((a, b) => a.productId.localeCompare(b.productId)),
      shippingMethod: payload.shippingMethod,
      paymentMethod: payload.paymentMethod,
      coupon: payload.couponCode?.trim().toUpperCase() ?? null,
      currency: payload.currency ?? 'USD',
    });
    return crypto.createHash('sha256').update(canonical).digest('hex');
  }

  public lockOrGetExisting(
    key: string,
    payloadHash: string
  ): { isCached: boolean; response?: CheckoutSessionResponse } {
    const existing = this.store.get(key);

    if (existing) {
      if (existing.payloadHash !== payloadHash) {
        throw new Error(
          `Idempotency Conflict (422): Key '${key}' was already used with a different request payload.`
        );
      }
      if (existing.status === 'IN_PROGRESS') {
        throw new Error(`Idempotency Conflict (409): Transaction with key '${key}' is currently in flight.`);
      }
      return { isCached: true, response: existing.response };
    }

    this.store.set(key, {
      status: 'IN_PROGRESS',
      payloadHash,
      createdAt: Date.now(),
    });

    return { isCached: false };
  }

  public commit(key: string, payloadHash: string, response: CheckoutSessionResponse): void {
    this.store.set(key, {
      status: 'COMPLETED',
      payloadHash,
      response,
      createdAt: Date.now(),
    });
  }

  public release(key: string): void {
    this.store.delete(key);
  }
}

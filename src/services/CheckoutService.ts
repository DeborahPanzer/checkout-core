import * as crypto from 'crypto';
import { CheckoutRequestPayload, CheckoutSessionResponse } from '../types/checkout.types';
import { PricingService } from './PricingService';
import { Iso3166Normalizer } from '../compliance/Iso3166Normalizer';
import { AvsVerifier } from '../compliance/AvsVerifier';
import { IdempotencyEngine } from '../core/IdempotencyEngine';
import { TwoPhaseCommitCoordinator } from '../core/TwoPhaseCommitCoordinator';

/**
 * CheckoutService coordinates inventory validation, pricing calculation, AVS/ISO-3166 compliance,
 * cryptographic idempotency, and Two-Phase Commit gateway execution.
 */
export class CheckoutService {
  private readonly pricingService = new PricingService();
  private readonly isoNormalizer = new Iso3166Normalizer();
  private readonly avsVerifier = new AvsVerifier();
  private readonly idempotencyEngine = new IdempotencyEngine();
  private readonly twoPhaseCommit = new TwoPhaseCommitCoordinator();

  public processCheckout(payload: CheckoutRequestPayload): CheckoutSessionResponse {
    this.validatePayload(payload);

    // 1. Cryptographic Idempotency Check
    const fingerprint = this.idempotencyEngine.computeFingerprint(payload);
    const idempotencyKey = payload.idempotencyKey ?? fingerprint;

    const lockResult = this.idempotencyEngine.lockOrGetExisting(idempotencyKey, fingerprint);
    if (lockResult.isCached && lockResult.response) {
      return lockResult.response;
    }

    try {
      // 2. ISO-3166 Geographical Normalization & AVS Verification
      const normalizedRegion = this.isoNormalizer.normalize(payload.shippingAddress);
      const avsResult = this.avsVerifier.verify(payload.shippingAddress, normalizedRegion);

      // 3. Minor-Unit Pricing Calculation
      const currency = payload.currency ?? 'USD';
      const pricing = this.pricingService.calculate(
        payload.items,
        payload.shippingMethod,
        payload.couponCode,
        currency
      );

      // 4. Two-Phase Commit (2PC) Transaction Execution
      const orderId = `ord_${crypto.randomBytes(10).toString('hex')}`;
      const txResult = this.twoPhaseCommit.executeAtomicCheckout(
        orderId,
        pricing.totalMinorUnits,
        currency,
        payload.paymentMethod
      );

      const response: CheckoutSessionResponse = {
        orderId,
        sessionId: `chk_${crypto.randomBytes(12).toString('hex')}`,
        status: avsResult.code === 'Y' ? 'AUTHORIZED' : 'REQUIRES_ACTION',
        pricing,
        paymentProvider: txResult.provider,
        createdAt: new Date().toISOString(),
        compliance: {
          iso3166Country: normalizedRegion.alpha2Country,
          iso3166Subdivision: normalizedRegion.isoSubdivision,
          avsCode: avsResult.code,
          idempotencyFingerprint: fingerprint,
          twoPhaseState: txResult.state,
        },
      };

      this.idempotencyEngine.commit(idempotencyKey, fingerprint, response);
      return response;
    } catch (error) {
      this.idempotencyEngine.release(idempotencyKey);
      throw error;
    }
  }

  private validatePayload(payload: CheckoutRequestPayload): void {
    if (!payload.customer?.email || !payload.customer?.name) {
      throw new Error('Customer name and email are required.');
    }
    if (!payload.shippingAddress?.postalCode || !payload.shippingAddress?.state) {
      throw new Error('US AVS validation requires state and postalCode in shippingAddress.');
    }
    if (!Array.isArray(payload.items) || payload.items.length === 0) {
      throw new Error('Checkout request must contain at least one item.');
    }
  }
}

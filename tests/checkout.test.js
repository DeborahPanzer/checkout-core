const test = require('node:test');
const assert = require('node:assert/strict');
const { CheckoutService } = require('../dist/index.js');

const createValidPayload = (overrides = {}) => ({
  customer: {
    name: 'Alice Vance',
    email: 'alice.vance@example.com',
    phone: '+12125550199',
  },
  shippingAddress: {
    address: '350 Fifth Avenue',
    city: 'New York',
    state: 'NY',
    postalCode: '10118',
    country: 'USA',
  },
  shippingMethod: 'express',
  paymentMethod: 'stripe_card',
  couponCode: 'WELCOME10',
  items: [{ productId: 'product-001', quantity: 2 }],
  currency: 'USD',
  ...overrides,
});

test('CheckoutService: authorizes valid transaction with ISO-3166, AVS Code Y, and 2PC COMMITTED state', () => {
  const service = new CheckoutService();
  const response = service.processCheckout(createValidPayload({ idempotencyKey: 'idem_valid_001' }));

  assert.equal(response.status, 'AUTHORIZED');
  assert.equal(response.paymentProvider, 'stripe-primary');
  assert.equal(response.pricing.subtotalMinorUnits, 9000);
  assert.equal(response.pricing.discountMinorUnits, 900);
  assert.equal(response.compliance.iso3166Country, 'US');
  assert.equal(response.compliance.iso3166Subdivision, 'US-NY');
  assert.equal(response.compliance.avsCode, 'Y');
  assert.equal(response.compliance.twoPhaseState, 'COMMITTED');
});

test('IdempotencyEngine: returns identical cached session on duplicate retry with same key and payload', () => {
  const service = new CheckoutService();
  const payload = createValidPayload({ idempotencyKey: 'idem_retry_002' });

  const firstAttempt = service.processCheckout(payload);
  const secondAttempt = service.processCheckout(payload);

  assert.equal(firstAttempt.orderId, secondAttempt.orderId);
  assert.equal(firstAttempt.sessionId, secondAttempt.sessionId);
  assert.equal(
    firstAttempt.compliance.idempotencyFingerprint,
    secondAttempt.compliance.idempotencyFingerprint
  );
});

test('IdempotencyEngine: throws 422 Conflict when reusing idempotencyKey with mutated item quantity', () => {
  const service = new CheckoutService();
  const key = 'idem_tamper_003';

  service.processCheckout(createValidPayload({ idempotencyKey: key }));

  assert.throws(
    () => {
      service.processCheckout(
        createValidPayload({
          idempotencyKey: key,
          items: [{ productId: 'product-001', quantity: 5 }],
        })
      );
    },
    /Idempotency Conflict \(422\)/
  );
});

test('Iso3166Normalizer & AvsVerifier: rejects invalid US state subdivision code', () => {
  const service = new CheckoutService();
  const badPayload = createValidPayload({
    shippingAddress: {
      address: '350 Fifth Avenue',
      city: 'New York',
      state: 'XX',
      postalCode: '10118',
      country: 'US',
    },
  });

  assert.throws(() => service.processCheckout(badPayload), /ISO-3166-2 Violation/);
});

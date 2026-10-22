const test = require('node:test');
const assert = require('node:assert/strict');
const {
  CheckoutService,
  ImmutableDoubleEntryLedger,
  WebhookSignatureVerifier,
  GatewayCircuitBreaker,
} = require('../dist/index.js');

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

test('ImmutableDoubleEntryLedger: enforces zero-sum balance and verifies SHA-256 hash chain', () => {
  const ledger = new ImmutableDoubleEntryLedger();
  const first = ledger.recordBalancedTransfer('ord_101', 'USD', 'acct_customer_receivable', 'acct_merchant_revenue', 9900);
  const second = ledger.recordBalancedTransfer('ord_102', 'USD', 'acct_customer_receivable', 'acct_merchant_revenue', 4500);

  assert.equal(first.sequence, 1);
  assert.equal(second.sequence, 2);
  assert.equal(second.previousHash, first.entryHash);
  assert.equal(ledger.verifyChainIntegrity(), true);
});

test('WebhookSignatureVerifier: validates constant-time HMAC-SHA256 signatures and blocks replay attacks', () => {
  const verifier = new WebhookSignatureVerifier();
  const secret = 'whsec_test_cryptographic_secret_key_99';
  const rawPayload = JSON.stringify({
    id: 'evt_stripe_001',
    type: 'payment_intent.succeeded',
    data: { amountReceivedMinor: 9900 },
  });

  const now = 1760000000;
  const validHeader = WebhookSignatureVerifier.signPayloadForTesting(rawPayload, secret, now);
  const event = verifier.verifyAndParse(rawPayload, validHeader, secret, 300, now + 10);

  assert.equal(event.id, 'evt_stripe_001');
  assert.equal(event.signatureValid, true);

  // Duplicate replay with same event.id must be suppressed
  assert.throws(
    () => verifier.verifyAndParse(rawPayload, validHeader, secret, 300, now + 15),
    /Webhook Idempotency Guard/
  );
});

test('GatewayCircuitBreaker: trips to OPEN after consecutive failures and routes to failover gateway', () => {
  const breaker = new GatewayCircuitBreaker(2, 60000);
  breaker.recordFailure('stripe-primary', 1000);
  breaker.recordFailure('stripe-primary', 2000);

  const routing = breaker.selectHealthyProvider('stripe-primary', 'adyen-failover', 2500);
  assert.equal(routing.failoverTriggered, true);
  assert.equal(routing.selectedProvider, 'adyen-failover');
  assert.equal(routing.circuitState, 'OPEN');
});

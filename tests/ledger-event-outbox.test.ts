import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  OutboxIdempotencyConflictError,
  TransactionalEventOutbox,
} from '../src/ledger-event-outbox.js';

const SHARED_SECRET =
  '9f8e7d6c5b4a39281706f5e4d3c2b1a09f8e7d6c5b4a39281706f5e4d3c2b1a0';

describe('TransactionalEventOutbox — Ecosystem Ledger & Refund Sync', () => {
  it('signs canonical capture events and passes constant-time HMAC verification', () => {
    const outbox = new TransactionalEventOutbox(SHARED_SECRET);
    const now = 1_762_920_000_000;

    const envelope = outbox.enqueue({
      eventId: 'evt_cap_0001',
      eventType: 'checkout.payment.captured',
      targetService: 'ledger-vault',
      idempotencyKey: 'idem_pi_9001_capture',
      paymentIntentId: 'pi_9001',
      correlationId: 'corr_9001',
      causationId: 'auth_9001',
      occurredAtEpochMs: now,
      currency: 'usd',
      amountMinor: 125_00n,
      debitAccountCode: 'ASSET:ACQUIRER_CLEARING_USD',
      creditAccountCode: 'LIABILITY:MERCHANT_PAYABLE_USD',
    });

    assert.equal(envelope.currency, 'USD');
    assert.equal(envelope.amountMinorStr, '12500');
    assert.equal(
      TransactionalEventOutbox.verifyEnvelopeIntegrity(envelope, SHARED_SECRET, now + 5_000),
      true
    );
  });

  it('returns identical cached envelope on idempotent retry and throws on payload mutation', () => {
    const outbox = new TransactionalEventOutbox(SHARED_SECRET);
    const baseInput = {
      eventId: 'evt_auth_0002',
      eventType: 'checkout.payment.authorized' as const,
      targetService: 'ledger-vault' as const,
      idempotencyKey: 'idem_pi_9002_auth',
      paymentIntentId: 'pi_9002',
      correlationId: 'corr_9002',
      causationId: 'req_9002',
      occurredAtEpochMs: 1_762_920_100_000,
      currency: 'EUR',
      amountMinor: 49_99n,
      debitAccountCode: 'ASSET:CARDHOLDER_AUTH_HOLD_EUR',
      creditAccountCode: 'LIABILITY:PENDING_CAPTURE_EUR',
    };

    const first = outbox.enqueue(baseInput);
    const duplicate = outbox.enqueue(baseInput);
    assert.deepEqual(duplicate, first);

    assert.throws(
      () =>
        outbox.enqueue({
          ...baseInput,
          amountMinor: 59_99n,
        }),
      OutboxIdempotencyConflictError
    );
  });

  it('rejects tampered amounts, expired replay windows, and self-referencing accounts', () => {
    const outbox = new TransactionalEventOutbox(SHARED_SECRET);
    const now = 1_762_920_200_000;

    const envelope = outbox.enqueue({
      eventId: 'evt_cap_0003',
      eventType: 'checkout.payment.captured',
      targetService: 'refund-guard',
      idempotencyKey: 'idem_pi_9003_cap',
      paymentIntentId: 'pi_9003',
      correlationId: 'corr_9003',
      causationId: 'auth_9003',
      occurredAtEpochMs: now,
      currency: 'USD',
      amountMinor: 250_00n,
      debitAccountCode: 'ASSET:ACQUIRER_CLEARING_USD',
      creditAccountCode: 'LIABILITY:MERCHANT_PAYABLE_USD',
    });

    const tampered = { ...envelope, amountMinorStr: '999900' };
    assert.equal(
      TransactionalEventOutbox.verifyEnvelopeIntegrity(tampered, SHARED_SECRET, now),
      false
    );

    assert.equal(
      TransactionalEventOutbox.verifyEnvelopeIntegrity(
        envelope,
        SHARED_SECRET,
        now + 600_000,
        300_000
      ),
      false
    );

    assert.throws(
      () =>
        outbox.enqueue({
          eventId: 'evt_bad_self',
          eventType: 'checkout.payment.voided',
          targetService: 'ledger-vault',
          idempotencyKey: 'idem_bad_self',
          paymentIntentId: 'pi_bad',
          correlationId: 'corr_bad',
          causationId: 'req_bad',
          occurredAtEpochMs: now,
          currency: 'USD',
          amountMinor: 10_00n,
          debitAccountCode: 'ASSET:CLEARING',
          creditAccountCode: 'ASSET:CLEARING',
        }),
      RangeError
    );
  });

  it('drains pending envelopes in FIFO order and suppresses acknowledged events', () => {
    const outbox = new TransactionalEventOutbox(SHARED_SECRET);
    const now = 1_762_920_300_000;

    outbox.enqueue({
      eventId: 'evt_fifo_1',
      eventType: 'checkout.payment.authorized',
      targetService: 'ledger-vault',
      idempotencyKey: 'idem_fifo_1',
      paymentIntentId: 'pi_1',
      correlationId: 'corr_1',
      causationId: 'req_1',
      occurredAtEpochMs: now,
      currency: 'USD',
      amountMinor: 10_00n,
      debitAccountCode: 'ASSET:HOLD_USD',
      creditAccountCode: 'LIABILITY:AUTH_USD',
    });

    outbox.enqueue({
      eventId: 'evt_fifo_2',
      eventType: 'checkout.payment.captured',
      targetService: 'ledger-vault',
      idempotencyKey: 'idem_fifo_2',
      paymentIntentId: 'pi_1',
      correlationId: 'corr_1',
      causationId: 'evt_fifo_1',
      occurredAtEpochMs: now + 100,
      currency: 'USD',
      amountMinor: 10_00n,
      debitAccountCode: 'ASSET:CLEARING_USD',
      creditAccountCode: 'LIABILITY:MERCHANT_USD',
    });

    assert.equal(outbox.drainPendingBatch(10).length, 2);
    assert.equal(outbox.acknowledgeDispatched('evt_fifo_1'), true);

    const remaining = outbox.drainPendingBatch(10);
    assert.equal(remaining.length, 1);
    assert.equal(remaining[0]?.eventId, 'evt_fifo_2');
  });
});

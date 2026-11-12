import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Transactional Event Outbox for Ecosystem Synchronization (v1.2.0).
 *
 * Guarantees at-least-once, idempotent, HMAC-SHA256 authenticated emission of
 * zero-sum payment lifecycle postings from `checkout-core` into `ledger-vault`
 * and `refund-guard`.
 */

export type CheckoutDomainEventType =
  | 'checkout.payment.authorized'
  | 'checkout.payment.captured'
  | 'checkout.payment.voided';

export type DownstreamTargetService = 'ledger-vault' | 'refund-guard';

export interface FinancialEventEnvelope {
  readonly eventId: string;
  readonly schemaVersion: '1.2.0';
  readonly eventType: CheckoutDomainEventType;
  readonly sourceService: 'checkout-core';
  readonly targetService: DownstreamTargetService;
  readonly idempotencyKey: string;
  readonly paymentIntentId: string;
  readonly correlationId: string;
  readonly causationId: string;
  readonly occurredAtEpochMs: number;
  readonly currency: string;
  readonly amountMinorStr: string;
  readonly debitAccountCode: string;
  readonly creditAccountCode: string;
  readonly payloadSha256: string;
  readonly hmacSignature: string;
}

export interface OutboxEnqueueInput {
  readonly eventId: string;
  readonly eventType: CheckoutDomainEventType;
  readonly targetService: DownstreamTargetService;
  readonly idempotencyKey: string;
  readonly paymentIntentId: string;
  readonly correlationId: string;
  readonly causationId: string;
  readonly occurredAtEpochMs: number;
  readonly currency: string;
  readonly amountMinor: bigint;
  readonly debitAccountCode: string;
  readonly creditAccountCode: string;
}

export class OutboxIdempotencyConflictError extends Error {
  public readonly idempotencyKey: string;

  public constructor(idempotencyKey: string) {
    super(
      `Idempotency conflict on outbox key "${idempotencyKey}": payload hash differs from original emission.`
    );
    this.name = 'OutboxIdempotencyConflictError';
    this.idempotencyKey = idempotencyKey;
  }
}

interface StoredOutboxRecord {
  readonly envelope: FinancialEventEnvelope;
  dispatched: boolean;
}

function computeCanonicalPayloadDigest(fields: {
  readonly eventId: string;
  readonly eventType: CheckoutDomainEventType;
  readonly targetService: DownstreamTargetService;
  readonly idempotencyKey: string;
  readonly paymentIntentId: string;
  readonly correlationId: string;
  readonly causationId: string;
  readonly currency: string;
  readonly amountMinorStr: string;
  readonly debitAccountCode: string;
  readonly creditAccountCode: string;
}): string {
  const canonical = [
    'v1.2.0',
    'checkout-core',
    fields.targetService,
    fields.eventId,
    fields.eventType,
    fields.idempotencyKey,
    fields.paymentIntentId,
    fields.correlationId,
    fields.causationId,
    fields.currency,
    fields.amountMinorStr,
    fields.debitAccountCode,
    fields.creditAccountCode,
  ].join('|');

  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

function signEnvelopeDigest(
  payloadSha256: string,
  occurredAtEpochMs: number,
  secretKey: string
): string {
  const signingInput = `${occurredAtEpochMs.toString(10)}.${payloadSha256}`;
  return createHmac('sha256', secretKey).update(signingInput, 'utf8').digest('hex');
}

export class TransactionalEventOutbox {
  private readonly signingSecret: string;
  private readonly recordsByIdempotencyKey = new Map<string, StoredOutboxRecord>();
  private readonly recordsByEventId = new Map<string, StoredOutboxRecord>();

  public constructor(signingSecret: string) {
    if (signingSecret.trim().length < 32) {
      throw new RangeError(
        'TransactionalEventOutbox signingSecret must be at least 32 characters.'
      );
    }
    this.signingSecret = signingSecret;
  }

  public enqueue(input: OutboxEnqueueInput): FinancialEventEnvelope {
    if (input.amountMinor <= 0n) {
      throw new RangeError('Outbox monetary amountMinor must be strictly positive (> 0n).');
    }

    const normalizedCurrency = input.currency.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(normalizedCurrency)) {
      throw new RangeError(`Invalid ISO-4217 currency code "${input.currency}".`);
    }

    const debitAccount = input.debitAccountCode.trim();
    const creditAccount = input.creditAccountCode.trim();
    if (debitAccount.length === 0 || creditAccount.length === 0) {
      throw new RangeError('Debit and credit ledger account codes must be non-empty.');
    }
    if (debitAccount === creditAccount) {
      throw new RangeError(
        'Zero-sum double-entry invariant violation: debitAccountCode cannot equal creditAccountCode.'
      );
    }

    const amountMinorStr = input.amountMinor.toString(10);
    const payloadSha256 = computeCanonicalPayloadDigest({
      eventId: input.eventId,
      eventType: input.eventType,
      targetService: input.targetService,
      idempotencyKey: input.idempotencyKey,
      paymentIntentId: input.paymentIntentId,
      correlationId: input.correlationId,
      causationId: input.causationId,
      currency: normalizedCurrency,
      amountMinorStr,
      debitAccountCode: debitAccount,
      creditAccountCode: creditAccount,
    });

    const existing = this.recordsByIdempotencyKey.get(input.idempotencyKey);
    if (existing !== undefined) {
      if (existing.envelope.payloadSha256 !== payloadSha256) {
        throw new OutboxIdempotencyConflictError(input.idempotencyKey);
      }
      return existing.envelope;
    }

    const hmacSignature = signEnvelopeDigest(
      payloadSha256,
      input.occurredAtEpochMs,
      this.signingSecret
    );

    const envelope: FinancialEventEnvelope = {
      eventId: input.eventId,
      schemaVersion: '1.2.0',
      eventType: input.eventType,
      sourceService: 'checkout-core',
      targetService: input.targetService,
      idempotencyKey: input.idempotencyKey,
      paymentIntentId: input.paymentIntentId,
      correlationId: input.correlationId,
      causationId: input.causationId,
      occurredAtEpochMs: input.occurredAtEpochMs,
      currency: normalizedCurrency,
      amountMinorStr,
      debitAccountCode: debitAccount,
      creditAccountCode: creditAccount,
      payloadSha256,
      hmacSignature,
    };

    const record: StoredOutboxRecord = { envelope, dispatched: false };
    this.recordsByIdempotencyKey.set(input.idempotencyKey, record);
    this.recordsByEventId.set(input.eventId, record);

    return envelope;
  }

  public drainPendingBatch(limit: number = 100): readonly FinancialEventEnvelope[] {
    if (!Number.isInteger(limit) || limit < 1) {
      throw new RangeError('Batch drain limit must be a positive integer.');
    }

    const batch: FinancialEventEnvelope[] = [];
    for (const record of this.recordsByEventId.values()) {
      if (!record.dispatched) {
        batch.push(record.envelope);
        if (batch.length >= limit) {
          break;
        }
      }
    }
    return batch;
  }

  public acknowledgeDispatched(eventId: string): boolean {
    const record = this.recordsByEventId.get(eventId);
    if (record === undefined) {
      return false;
    }
    record.dispatched = true;
    return true;
  }

  public static verifyEnvelopeIntegrity(
    envelope: FinancialEventEnvelope,
    signingSecret: string,
    nowEpochMs: number,
    replayToleranceMs: number = 300_000
  ): boolean {
    if (Math.abs(nowEpochMs - envelope.occurredAtEpochMs) > replayToleranceMs) {
      return false;
    }

    const expectedPayloadSha256 = computeCanonicalPayloadDigest({
      eventId: envelope.eventId,
      eventType: envelope.eventType,
      targetService: envelope.targetService,
      idempotencyKey: envelope.idempotencyKey,
      paymentIntentId: envelope.paymentIntentId,
      correlationId: envelope.correlationId,
      causationId: envelope.causationId,
      currency: envelope.currency,
      amountMinorStr: envelope.amountMinorStr,
      debitAccountCode: envelope.debitAccountCode,
      creditAccountCode: envelope.creditAccountCode,
    });

    if (expectedPayloadSha256 !== envelope.payloadSha256) {
      return false;
    }

    const expectedHmacHex = signEnvelopeDigest(
      expectedPayloadSha256,
      envelope.occurredAtEpochMs,
      signingSecret
    );

    const expectedBuf = Buffer.from(expectedHmacHex, 'hex');
    const providedBuf = Buffer.from(envelope.hmacSignature, 'hex');

    if (expectedBuf.length === 0 || expectedBuf.length !== providedBuf.length) {
      return false;
    }

    return timingSafeEqual(expectedBuf, providedBuf);
  }
}

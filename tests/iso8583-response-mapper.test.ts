import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyIso8583Response,
  evaluateRetryEligibility,
} from '../src/iso8583-response-mapper.js';

describe('ISO-8583 DE39 Response Mapper & Smart Retry Classifier', () => {
  it('classifies DE39 00 as APPROVED with zero retry directive', () => {
    const decision = evaluateRetryEligibility('00', 1, 3);
    assert.equal(decision.classification.category, 'APPROVED');
    assert.equal(decision.eligible, false);
    assert.equal(decision.rejectionGuardReason, 'ALREADY_APPROVED');
    assert.equal(decision.classification.schemeRetryFeeRisk, false);
  });

  it('strictly blocks retries on Hard Declines and Stolen/Fraud Security Blocks', () => {
    for (const terminalCode of ['12', '14', '41', '43', '54', '57', '59']) {
      const decision = evaluateRetryEligibility(terminalCode, 1, 3);
      assert.equal(decision.eligible, false);
      assert.equal(decision.rejectionGuardReason, 'TERMINAL_SCHEME_DECLINE_NO_RETRY');
      assert.equal(decision.classification.schemeRetryFeeRisk, true);
    }
  });

  it('triggers immediate acquirer rail failover and circuit penalty on 91 and 96 outages', () => {
    const decision91 = evaluateRetryEligibility('91', 1, 3);
    assert.equal(decision91.eligible, true);
    assert.equal(decision91.switchAcquirerRail, true);
    assert.equal(decision91.classification.triggerAcquirerCircuitPenalty, true);
    assert.equal(decision91.nextDelayMs, 1_000);

    const decision96 = evaluateRetryEligibility('96', 2, 3);
    assert.equal(decision96.eligible, true);
    assert.equal(decision96.switchAcquirerRail, true);
    assert.equal(decision96.nextDelayMs, 4_000);
  });

  it('applies exponential backoff on Soft Declines and enforces maxSoftRetries cap', () => {
    const attempt1 = evaluateRetryEligibility('05', 1, 2);
    assert.equal(attempt1.eligible, true);
    assert.equal(attempt1.nextDelayMs, 30_000);
    assert.equal(attempt1.switchAcquirerRail, false);

    const attempt2 = evaluateRetryEligibility('05', 2, 2);
    assert.equal(attempt2.eligible, true);
    assert.equal(attempt2.nextDelayMs, 60_000);

    const exhausted = evaluateRetryEligibility('05', 3, 2);
    assert.equal(exhausted.eligible, false);
    assert.equal(exhausted.rejectionGuardReason, 'MAX_SOFT_RETRY_BUDGET_EXHAUSTED');
  });

  it('defaults unmapped codes conservatively to HARD_DECLINE and rejects malformed inputs', () => {
    const unknown = classifyIso8583Response('ZZ');
    assert.equal(unknown.category, 'HARD_DECLINE');
    assert.equal(unknown.retryDirective, 'DO_NOT_RETRY');

    assert.throws(() => classifyIso8583Response('005'), RangeError);
    assert.throws(() => evaluateRetryEligibility('05', 0, 3), RangeError);
  });
});

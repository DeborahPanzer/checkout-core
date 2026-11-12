# Operational Runbook: Transactional Outbox Lag & 3-Way Reconciliation Drift

## 1. Trigger Conditions

This runbook activates when either treasury invariant alert triggers:

* `OUTBOX_UNDISPATCHED_AGE_HIGH`: Unacknowledged envelopes in `TransactionalEventOutbox` exceed `120 seconds` or `1,000` queued postings.
* `EOD_THREE_WAY_RECON_BREAK`: Daily SHA-256 Merkle batch root from `checkout-core` diverges from ingested journal postings in `ledger-vault` or acquirer settlement files.

## 2. Standard Operating Procedure (SOP)

1. **Step 1 — Verify Cryptographic Signing & Clock Skew:**
   * Inspect downstream HTTP rejection codes from `ledger-vault`.
   * If `401 HMAC_VERIFICATION_FAILED` is observed, verify NTP clock synchronization (`|drift| < 5000ms`) and confirm `ECOSYSTEM_HMAC_SIGNING_SECRET` key-version parity across services.
2. **Step 2 — Execute Idempotent Batch Replay:**
   * Drain pending outbox records in strict FIFO causal order (`drainPendingBatch(100)`) using the historic `idempotencyKey` and `payloadSha256`.
   * For legitimate historical replays exceeding the 5-minute live window (`300,000ms`), route batches through the authenticated administrative backfill endpoint with dual-control Treasury sign-off.
3. **Step 3 — Resolve `OutboxIdempotencyConflictError` Exceptions:**
   * **Quarantine:** Never overwrite or delete conflicting outbox keys in place.
   * **Audit:** Compare `amountMinorStr`, `currency`, and CoA account legs against the acquirer settlement record and issue an explicit append-only compensating adjustment in `ledger-vault`.

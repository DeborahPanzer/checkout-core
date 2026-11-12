# Operational Runbook: Primary Acquirer Circuit-Breaker Open & Rail Failover

## 1. Trigger Conditions

An alert `CHECKOUT_ACQUIRER_CIRCUIT_OPEN` fires when either condition is met within a rolling 60-second window:

* Primary acquirer consecutive network timeouts (`> 2500ms`) or HTTP `5xx` responses exceed `CIRCUIT_BREAKER_FAILURE_THRESHOLD` (`5`).
* Upstream card switch returns consecutive ISO-8583 DE39 `91` (`ISSUER_OR_SWITCH_INOPERATIVE`) or `96` (`SYSTEM_MALFUNCTION`) responses flagged with `triggerAcquirerCircuitPenalty = true`.

## 2. Automated System Behavior

1. `src/circuit-breaker.ts` transitions the primary rail from `CLOSED` to `OPEN` for `30,000ms`.
2. `src/iso8583-response-mapper.ts` emits `retryDirective = IMMEDIATE_FAILOVER` while preserving the original `Idempotency-Key` and EMV network token cryptogram.
3. `src/saga-orchestrator.ts` routes eligible in-flight authorizations to `SECONDARY_ACQUIRER_ID` without releasing the local idempotency lock, preventing double-charge hazards.

## 3. Standard Operating Procedure (SOP)

1. **Step 1 — Verify Acquirer vs Issuer Scope:**
   * Inspect DE39 telemetry distribution. If `91` is isolated to a single 6-digit issuer BIN while other BINs succeed (`00`), do **not** manually pin global traffic away from the primary acquirer.
   * If failures span multiple schemes (Visa, Mastercard, Amex), confirm upstream acquirer status page degradation.
2. **Step 2 — Audit Half-Open Probe Recovery:**
   * Confirm that `HALF_OPEN` single-request probes succeed with P99 latency `< 1200ms` for at least 10 consecutive authorizations before clearing manual traffic overrides.
3. **Step 3 — Reconcile Late Upstream Responses:**
   * Any late `200 OK` arriving from the timed-out primary rail after failover completion MUST be queued for immediate automated `checkout.payment.voided` reversal and verified against `ledger-vault`.

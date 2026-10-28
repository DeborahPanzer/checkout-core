# ADR 0001: Hybrid Two-Phase Commit (2PC) and Saga Orchestration for Payment Settlement

* **Status:** Accepted
* **Date:** 2026-10-28
* **Deciders:** Deborah Panzer (Principal Payment Systems Architect)

## Context and Problem Statement

External payment processors (Stripe, Adyen, Braintree) operate over asynchronous HTTP/Webhook boundaries and do not expose XA/two-phase commit database coordinators. However, internal double-entry ledger updates require strict `SERIALIZABLE` ACID guarantees to prevent write skew and double-spending.

## Decision Outcome

We adopt a **Hybrid Execution Model**:

1. **Internal State & Ledger Locking (Two-Phase Commit / Pessimistic ACID):**
   Reservation of customer idempotency keys and merchant escrow balances utilizes strict relational locking (`SELECT ... FOR UPDATE NOWAIT`) prior to dispatching external network calls.
2. **External Gateway Coordination (Saga Pattern with Reverse Compensation):**
   Cross-network authorization and capture flows are managed via `PaymentSagaOrchestrator`. If an upstream capture succeeds but downstream settlement fails, deterministic compensating reversals are enqueued automatically.

## Consequences

* **Positive:** Eliminates distributed lock contention across high-latency external HTTP calls while preserving zero-sum internal accounting invariants.
* **Negative:** Requires idempotent compensating handlers and dead-letter queue (DLQ) reconciliation workers for unrecoverable gateway timeouts.

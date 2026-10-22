# Checkout Core — Formal Architecture & Mathematical Invariants

`checkout-core` is engineered around four non-negotiable financial systems invariants: **Monetary Precision**, **Cryptographic Idempotency**, **Zero-Sum Double-Entry Accounting**, and **Atomic Two-Phase Commit (2PC) State Transitions**.

---

## 1. Zero-Sum Double-Entry Conservation Invariant

Every monetary mutation in `ImmutableDoubleEntryLedger` is recorded as a balanced journal entry $J_k$ operating strictly on integer minor units ($\mathbb{Z}^+$):

$$\sum_{i \in \text{Debits}(J_k)} m_i - \sum_{j \in \text{Credits}(J_k)} m_j = 0$$

To guarantee tamper-evident auditability across sequential entries $J_1, J_2, \dots, J_n$, each journal entry commits to the cryptographic digest of its predecessor:

$$H_k = \text{SHA256}\left(k \parallel \text{id}_k \parallel \text{order}_k \parallel \text{lines}_k \parallel H_{k-1} \parallel t_k\right), \quad H_0 = 0^{64}$$

Any retroactive mutation to historical ledger state invalidates all subsequent hashes $H_{k \dots n}$ during `verifyChainIntegrity()` audits.

---

## 2. Two-Phase Commit (2PC) & Circuit Breaker Pipeline

```text
[Client Request]
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│ 1. Cryptographic Idempotency Lock (SHA-256 Fingerprint)  │
│    • Key Reuse + Mutated Payload  ──► 422 Conflict       │
│    • Concurrent In-Flight Request ──► 409 Conflict       │
└───────────────────────────┬──────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────┐
│ 2. ISO-3166-1/2 Normalization & Deterministic AVS Engine │
│    • Alpha-3 / Country Name ──► Canonical ISO Alpha-2    │
│    • Street + Postal Regex  ──► AVS Code (Y / A / Z / N) │
└───────────────────────────┬──────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────┐
│ 3. Two-Phase Commit (2PC) & Double-Entry Ledger          │
│    • Phase 1: Write-Ahead Log [PREPARED]                 │
│    • Circuit Breaker Health Check (Stripe ──► Adyen)     │
│    • Phase 2: Atomic Capture [COMMITTED] or [ABORTED]    │
└──────────────────────────────────────────────────────────┘

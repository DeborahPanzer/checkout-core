<div align="center">

# 💳 Checkout Core & Transaction Engine

[![Checkout Core CI & Compliance Suite](https://github.com/DeborahPanzer/checkout-core/actions/workflows/ci.yml/badge.svg)](https://github.com/DeborahPanzer/checkout-core/actions/workflows/ci.yml)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Architecture: Two-Phase Commit | Saga](https://img.shields.io/badge/Architecture-Two--Phase_Commit_%7C_Saga-2ea44f)](ARCHITECTURE.md)
[![Compliance: PCI-DSS v4.0.1 | ISO-4217](https://img.shields.io/badge/Compliance-PCI--DSS_v4.0.1_%7C_ISO--4217-blueviolet)](docs/PCI-DSS-V4-COMPLIANCE-MATRIX.md)
[![Formal Verification: TLA+](https://img.shields.io/badge/Formal_Verification-TLA%2B-informational)](specs/PaymentStateMachine.tla)
[![Language: TypeScript 100%](https://img.shields.io/badge/Language-TypeScript_100%25-3178c6)](tsconfig.json)
[![Sponsor](https://img.shields.io/badge/Sponsor-DeborahPanzer-ea4aaa?logo=github-sponsors&logoColor=white)](https://github.com/sponsors/DeborahPanzer)

</div>

---

`checkout-core` is an enterprise-grade, zero-dependency transactional payment processing engine engineered for strict **ACID compliance**, **zero-sum double-entry accounting**, **PCI-DSS v4.0.1 cryptographic isolation**, and **fault-tolerant multi-acquirer execution**.

---

## 🏛️ Architectural Execution Pipeline

```text
                         [Client / Wallet Request]
                                     │
                                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ 1. EDGE SECURITY & VELOCITY SHIELD                                       │
│    • Sliding-Window Velocity Limiter (src/velocity-limiter.ts)           │
│    • AES-256-GCM PAN Vault & Luhn Check (src/tokenization-vault.ts)      │
│    • EMV Network Token & Cryptogram (src/network-token-cryptogram.ts)    │
└────────────────────────────────────┬─────────────────────────────────────┘
                                     │
                                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ 2. COMPLIANCE, RISK & SMART ROUTING                                      │
│    • ISO-3166 Address Normalization & AVS Scoring (src/compliance/)      │
│    • EMV 3-D Secure 2 & PSD2 SCA Router (src/three-d-secure.ts)          │
│    • US Reg II Least-Cost Debit Selector (src/bin-routing-table.ts)      │
│    • ISO-8583 DE39 Retry Classifier (src/iso8583-response-mapper.ts)     │
└────────────────────────────────────┬─────────────────────────────────────┘
                                     │
                                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ 3. DISTRIBUTED SAGA, ACID LEDGER & SETTLEMENT                            │
│    • Hybrid 2PC Lock & Saga Runner (src/saga-orchestrator.ts)            │
│    • Multi-Gateway Circuit Breaker (src/circuit-breaker.ts)              │
│    • ISO-4217 Banker's Rounding FX Engine (src/fx-conversion.ts)         │
│    • Interchange++ & Scheme Fee Engine (src/interchange-plus.ts)         │
│    • HMAC Ecosystem Ledger Outbox (src/ledger-event-outbox.ts)           │
│    • SHA-256 Merkle Seal & 3-Way Recon (src/reconciliation-matcher.ts)   │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 🔗 Unified Payment Mesh Integration (`v1.2.0`)

`checkout-core` serves as the upstream authorization and capture ingress for the four-repository financial core ecosystem, emitting deterministic `HMAC-SHA256` signed `FinancialEventEnvelope` postings via `src/ledger-event-outbox.ts`:

* **`ledger-vault`:** Ingests `checkout.payment.authorized`, `checkout.payment.captured`, and `checkout.payment.voided` envelopes into an append-only, `Serializable` ACID double-entry Chart of Accounts.
* **`refund-guard`:** Consumes immutable capture ceilings and FX rate pins to enforce zero over-refund invariants, Visa CE 3.0 representment, and pre-dispute deflection.
* **`payout-engine`:** Settles cleared merchant payable balances across FedNow (`pacs.008`), NACHA ACH, and SEPA rails under Two-Phase Commit (2PC) coordination.

---

## 📂 Repository Structure & Core Modules

```text
checkout-core/
├── .github/
│   ├── FUNDING.yml                                    # GitHub Sponsors manifest
│   └── workflows/ci.yml                               # Automated TypeScript strict build & CI suite
├── docs/
│   ├── adr/
│   │   ├── 0001-hybrid-2pc-saga-settlement.md         # ADR-0001: Hybrid 2PC & Saga settlement
│   │   └── 0002-multi-acquirer-smart-routing-and-reg-ii.md # ADR-0002: Reg II debit routing
│   ├── runbooks/
│   │   ├── acquirer-circuit-open-failover.md          # SOP: Acquirer outage & DE39 91/96 failover
│   │   └── ledger-outbox-reconciliation-drift.md      # SOP: Outbox lag & 3-way reconciliation drift
│   ├── ECOSYSTEM_EVENT_CONTRACTS.md                   # v1.2.0 cross-service HMAC event contract
│   └── PCI-DSS-V4-COMPLIANCE-MATRIX.md                # PCI-DSS v4.0.1 cryptographic control matrix
├── specs/
│   ├── PaymentStateMachine.tla                        # TLA+ formal proof of No-Double-Capture
│   └── SettlementBatchReconciliation.tla              # TLA+ formal proof of Conservation-of-Funds
├── src/
│   ├── compliance/                                    # ISO-3166 normalizer & AVS address verifier
│   ├── core/                                          # Idempotency engine, 2PC & hash-chained ledger
│   ├── logging/                                       # PCI-DSS sanitized structured JSON audit logger
│   ├── resilience/                                    # Distributed failover & recovery primitives
│   ├── security/                                      # Statistical Z-score anomaly & velocity tracker
│   ├── services/                                      # Core CheckoutService & minor-unit PricingService
│   ├── settlement/                                    # Merchant settlement & fee payout pipelines
│   ├── types/                                         # Domain DTOs and audit compliance contracts
│   ├── webhooks/                                      # Constant-time HMAC-SHA256 signature verifier
│   ├── bin-routing-table.ts                           # US Reg II PINless debit & smart rail selector
│   ├── circuit-breaker.ts                             # State-driven (CLOSED/OPEN/HALF_OPEN) breaker
│   ├── fx-conversion.ts                               # ISO-4217 BigInt FX with Banker's Rounding
│   ├── interchange-plus.ts                            # Interchange++, scheme & Durbin cap calculator
│   ├── iso8583-codec.ts                               # ISO-8583 wire message encoder & parser
│   ├── iso8583-response-mapper.ts                     # DE39 decline classifier & retry fee guard
│   ├── iso20022-pain001.ts                            # ISO-20022 (pain.001.001.09) XML builder
│   ├── ledger-event-outbox.ts                         # HMAC-SHA256 transactional ecosystem outbox
│   ├── merkle-audit.ts                                # SHA-256 Merkle batch sealer & O(log N) proofs
│   ├── network-token-cryptogram.ts                    # Apple/Google Pay DPAN & TAVV cryptogram check
│   ├── outbox-relay.ts                                # Transactional outbox relay & jittered backoff
│   ├── reconciliation-matcher.ts                      # 3-way reconciliation (Intent/Capture/Bank)
│   ├── saga-orchestrator.ts                           # Distributed Saga runner with LIFO compensation
│   ├── three-d-secure.ts                              # EMV 3DS2 RBA engine & PSD2 SCA exemptions
│   ├── tokenization-vault.ts                          # AES-256-GCM PAN vault & ISO-7812 Luhn check
│   ├── velocity-limiter.ts                            # Sliding-window BIN attack & carding defense
│   └── index.ts                                       # Public API barrel export
├── tests/
│   ├── checkout.test.js                               # Core cryptographic, ACID ledger & AVS suite
│   ├── iso8583-response-mapper.test.ts                # DE39 hard/soft decline & failover unit tests
│   └── ledger-event-outbox.test.ts                    # HMAC outbox signing & replay defense tests
├── .env.example                                       # PCI-DSS vault, circuit & outbox env template
├── .gitattributes                                     # Linguist 100% TypeScript & LF normalization
├── .gitignore                                         # Strict secret, build & artifact exclusions
├── ARCHITECTURE.md                                    # Formal ACID invariants & 2PC state machines
├── BENCHMARK.md                                       # High-throughput concurrency & P99 metrics
├── CHANGELOG.md                                       # Enterprise semantic release history
├── LICENSE                                            # Apache-2.0 open-source license
├── README.md                                          # Architectural overview & operational index
├── SECURITY.md                                        # PCI-DSS v4.0.1 vulnerability disclosure policy
├── package.json                                       # Package manifest & verification scripts
└── tsconfig.json                                      # Strict TypeScript compiler configuration
```

---

## ⚙️ Key Enterprise Capabilities

* **Cryptographic Idempotency & Single-Capture Invariant:** Enforces deterministic SHA-256 payload fingerprinting and TLA+ verified state transitions (`specs/PaymentStateMachine.tla`) to eliminate double-charging across network retries.
* **PCI-DSS v4.0.1 Envelope Tokenization & EMV Cryptograms:** Isolates Primary Account Numbers (PAN) using authenticated **AES-256-GCM** encryption (`src/tokenization-vault.ts`) and validates **Apple Pay / Google Pay TAVV cryptograms** (`src/network-token-cryptogram.ts`).
* **Smart Multi-Acquirer Routing, DE39 Retry Guard & Regulation II:** Combines real-time **Circuit Breakers** (`src/circuit-breaker.ts`), **ISO-8583 DE39 Hard/Soft Decline Classification** (`src/iso8583-response-mapper.ts`, `src/iso8583-codec.ts`) to prevent Visa/Mastercard retry penalties, and **US Durbin / Regulation II PINless Debit Routing** (`src/bin-routing-table.ts`).
* **ISO-4217 Fixed-Point FX & Interchange++ Accounting:** Processes all monetary values in `BigInt` minor units using deterministic **Banker's Rounding (Round Half to Even)** (`src/fx-conversion.ts`) and decomposes issuer interchange, card scheme assessments, and processor markups (`src/interchange-plus.ts`).
* **HMAC Ecosystem Outbox & Tamper-Evident Reconciliation:** Emits replay-protected, constant-time **HMAC-SHA256** signed ledger postings (`src/ledger-event-outbox.ts`, `src/outbox-relay.ts`), seals batches into **SHA-256 Merkle Trees** (`src/merkle-audit.ts`), and cross-verifies internal intents against processor captures and **ISO-20022 (`pain.001.001.09`)** clearing files (`src/reconciliation-matcher.ts`).

---

## 🧪 Verification & Compliance Suite

```bash
# 1. Copy environment configuration template for local testing
cp .env.example .env

# 2. Execute strict TypeScript static type verification & build
npm run build

# 3. Run zero-dependency cryptographic, ISO-8583, outbox, and ACID test suite
npm test
```

---

## 📜 Documentation, Runbooks & Governance

* [**System Architecture & State Machines (`ARCHITECTURE.md`)**](ARCHITECTURE.md)
* [**Unified Ecosystem Event Contracts (`docs/ECOSYSTEM_EVENT_CONTRACTS.md`)**](docs/ECOSYSTEM_EVENT_CONTRACTS.md)
* [**PCI-DSS v4.0.1 Compliance Control Matrix (`docs/PCI-DSS-V4-COMPLIANCE-MATRIX.md`)**](docs/PCI-DSS-V4-COMPLIANCE-MATRIX.md)
* [**ADR-0001: Hybrid 2PC & Saga Orchestration (`docs/adr/0001-hybrid-2pc-saga-settlement.md`)**](docs/adr/0001-hybrid-2pc-saga-settlement.md)
* [**ADR-0002: Multi-Acquirer Routing & Reg II (`docs/adr/0002-multi-acquirer-smart-routing-and-reg-ii.md`)**](docs/adr/0002-multi-acquirer-smart-routing-and-reg-ii.md)
* [**Runbook: Acquirer Circuit-Breaker Failover (`docs/runbooks/acquirer-circuit-open-failover.md`)**](docs/runbooks/acquirer-circuit-open-failover.md)
* [**Runbook: Ledger Outbox & Recon Drift (`docs/runbooks/ledger-outbox-reconciliation-drift.md`)**](docs/runbooks/ledger-outbox-reconciliation-drift.md)
* [**Performance & Concurrency Benchmarks (`BENCHMARK.md`)**](BENCHMARK.md)
* [**Enterprise Release Changelog (`CHANGELOG.md`)**](CHANGELOG.md)
* [**Security & Vulnerability Disclosure (`SECURITY.md`)**](SECURITY.md)

## License

Licensed under the **Apache License, Version 2.0**. See [LICENSE](LICENSE) for full details.

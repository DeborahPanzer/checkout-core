<div align="center">

# 💳 Checkout Core & Transaction Engine

[![Checkout Core CI & Compliance Suite](https://github.com/DeborahPanzer/checkout-core/actions/workflows/ci.yml/badge.svg)](https://github.com/DeborahPanzer/checkout-core/actions/workflows/ci.yml)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Architecture: Two-Phase Commit | Saga](https://img.shields.io/badge/Architecture-Two--Phase_Commit_%7C_Saga-2ea44f)](#)
[![Compliance: PCI-DSS v4.0.1 | ISO-4217](https://img.shields.io/badge/Compliance-PCI--DSS_v4.0.1_%7C_ISO--4217-blueviolet)](#)
[![Formal Verification: TLA+](https://img.shields.io/badge/Formal_Verification-TLA%2B-informational)](#)
[![Language: TypeScript 100%](https://img.shields.io/badge/Language-TypeScript_100%25-3178c6)](#)
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
┌──────────────────────────────────────────────────────────────────┐
│ 1. EDGE SECURITY & VELOCITY SHIELD                               │
│    • Sliding-Window Velocity Limiter (src/velocity-limiter.ts)   │
│    • AES-256-GCM PAN Vault & Luhn Check (src/tokenization-vault) │
│    • EMV Network Token & Cryptogram (src/network-token-cryptogram│
└────────────────────────────────┬─────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│ 2. COMPLIANCE, RISK & SMART ROUTING                              │
│    • ISO-3166 Address Normalization & AVS Risk Scoring           │
│    • EMV 3-D Secure 2 & PSD2 SCA Router (src/three-d-secure.ts)  │
│    • US Reg II Least-Cost Debit Selector (src/bin-routing-table) │
└────────────────────────────────┬─────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│ 3. DISTRIBUTED SAGA, ACID LEDGER & SETTLEMENT                    │
│    • Hybrid 2PC Lock & Saga Runner (src/saga-orchestrator.ts)    │
│    • Multi-Gateway Circuit Breaker (src/circuit-breaker.ts)      │
│    • ISO-4217 Banker's Rounding FX Engine (src/fx-conversion.ts) │
│    • Interchange++ & Scheme Fee Engine (src/interchange-plus.ts) │
│    • SHA-256 Merkle Batch Audit & 3-Way Reconciliation           │
└──────────────────────────────────────────────────────────────────┘
```

---

## 📂 Repository Structure & Core Modules

```text
checkout-core/
├── .github/workflows/ci.yml                   # Automated TypeScript strict build & CI suite
├── docs/
│   ├── adr/
│   │   ├── 0001-hybrid-2pc-saga-settlement.md # ADR-0001: Hybrid 2PC & Saga settlement
│   │   └── 0002-multi-acquirer-smart-routing-and-reg-ii.md # ADR-0002: Reg II debit routing
│   └── PCI-DSS-V4-COMPLIANCE-MATRIX.md        # PCI-DSS v4.0.1 cryptographic control matrix
├── specs/
│   ├── PaymentStateMachine.tla                # TLA+ formal proof of No-Double-Capture
│   └── SettlementBatchReconciliation.tla      # TLA+ formal proof of Conservation-of-Funds
├── src/
│   ├── compliance/                            # ISO-3166 normalizer & AVS address verifier
│   ├── core/                                  # Idempotency engine, 2PC & hash-chained ledger
│   ├── logging/                               # PCI-DSS sanitized structured JSON audit logger
│   ├── resilience/                            # Distributed failover & recovery primitives
│   ├── security/                              # Statistical Z-score anomaly & velocity tracker
│   ├── settlement/                            # Merchant settlement & fee payout pipelines
│   ├── webhooks/                              # Constant-time HMAC-SHA256 signature verifier
│   ├── services/                              # Core CheckoutService & minor-unit PricingService
│   ├── types/                                 # Domain DTOs and audit compliance contracts
│   ├── bin-routing-table.ts                   # US Reg II PINless debit & smart rail selector
│   ├── circuit-breaker.ts                     # State-driven (CLOSED/OPEN/HALF_OPEN) breaker
│   ├── fx-conversion.ts                       # ISO-4217 BigInt FX with Banker's Rounding
│   ├── interchange-plus.ts                    # Interchange++, scheme & Durbin cap calculator
│   ├── iso8583-codec.ts                       # Acquirer response classifier (Hard vs Soft)
│   ├── iso20022-pain001.ts                    # ISO-20022 (pain.001.001.09) XML builder
│   ├── merkle-audit.ts                        # SHA-256 Merkle batch sealer & O(log N) proofs
│   ├── network-token-cryptogram.ts            # Apple/Google Pay DPAN & TAVV cryptogram check
│   ├── outbox-relay.ts                        # Transactional outbox relay & jittered backoff
│   ├── reconciliation-matcher.ts              # 3-way reconciliation (Intent/Capture/Bank)
│   ├── saga-orchestrator.ts                   # Distributed Saga runner with LIFO compensation
│   ├── three-d-secure.ts                      # EMV 3DS2 RBA engine & PSD2 SCA exemptions
│   ├── tokenization-vault.ts                  # AES-256-GCM PAN vault & ISO-7812 Luhn check
│   ├── velocity-limiter.ts                    # Sliding-window BIN attack & carding defense
│   └── index.ts                               # Public API barrel export
├── tests/
│   └── checkout.test.js                       # Zero-dependency native Node.js test suite
├── .gitattributes                             # Linguist classification & LF normalization
├── ARCHITECTURE.md                            # Formal ACID invariants & 2PC state machines
├── BENCHMARK.md                               # High-throughput concurrency & latency metrics
├── CHANGELOG.md                               # Enterprise semantic release history (v1.1.0)
├── SECURITY.md                                # PCI-DSS v4.0.1 vulnerability disclosure policy
├── package.json                               # Package manifest & verification scripts
└── tsconfig.json                              # Strict TypeScript compiler configuration
```

---

## ⚙️ Key Enterprise Capabilities

* **Cryptographic Idempotency & Single-Capture Invariant:** Enforces deterministic SHA-256 payload fingerprinting and TLA+ verified state transitions (`specs/PaymentStateMachine.tla`) to eliminate double-charging across network retries.
* **PCI-DSS v4.0.1 Envelope Tokenization & EMV Cryptograms:** Isolates Primary Account Numbers (PAN) using authenticated **AES-256-GCM** encryption (`src/tokenization-vault.ts`) and validates **Apple Pay / Google Pay TAVV cryptograms** (`src/network-token-cryptogram.ts`).
* **Smart Multi-Acquirer Routing & Regulation II Optimization:** Combines real-time **Circuit Breakers** (`src/circuit-breaker.ts`), **ISO-8583 Decline Classification** (`src/iso8583-codec.ts`), and **US Durbin / Regulation II PINless Debit Routing** (`src/bin-routing-table.ts`).
* **ISO-4217 Fixed-Point FX & Interchange++ Accounting:** Processes all monetary values in `BigInt` minor units using deterministic **Banker's Rounding (Round Half to Even)** (`src/fx-conversion.ts`) and decomposes issuer interchange, card scheme assessments, and processor markups (`src/interchange-plus.ts`).
* **Tamper-Evident Merkle Auditing & Three-Way Reconciliation:** Seals settlement batches into **SHA-256 Merkle Trees** with $O(\log N)$ inclusion proofs (`src/merkle-audit.ts`) and cross-verifies internal intents against processor captures and **ISO-20022 (`pain.001.001.09`)** bank clearing files (`src/reconciliation-matcher.ts`).

---

## 🧪 Verification & Compliance Suite

```bash
# 1. Execute strict TypeScript static type verification
npm run build

# 2. Run zero-dependency cryptographic, ACID ledger, and AVS test suite
npm test
```

---

## 📜 Documentation & Governance

* [**System Architecture & State Machines (`ARCHITECTURE.md`)**](ARCHITECTURE.md)
* [**PCI-DSS v4.0.1 Compliance Control Matrix (`docs/PCI-DSS-V4-COMPLIANCE-MATRIX.md`)**](docs/PCI-DSS-V4-COMPLIANCE-MATRIX.md)
* [**ADR-0001: Hybrid 2PC & Saga Orchestration (`docs/adr/0001-hybrid-2pc-saga-settlement.md`)**](docs/adr/0001-hybrid-2pc-saga-settlement.md)
* [**ADR-0002: Multi-Acquirer Routing & Reg II (`docs/adr/0002-multi-acquirer-smart-routing-and-reg-ii.md`)**](docs/adr/0002-multi-acquirer-smart-routing-and-reg-ii.md)
* [**Performance & Concurrency Benchmarks (`BENCHMARK.md`)**](BENCHMARK.md)
* [**Security & Vulnerability Disclosure (`SECURITY.md`)**](SECURITY.md)

## License

Licensed under the **Apache License, Version 2.0**. See [LICENSE](LICENSE) for full details.

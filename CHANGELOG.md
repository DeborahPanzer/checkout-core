# Changelog

All notable changes to `checkout-core` are documented in this file.
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-10-28

### Added
* **Multi-Gateway Circuit Breaker (`src/circuit-breaker.ts`):** State-driven health tracking (`CLOSED`, `OPEN`, `HALF_OPEN`) for automatic gateway failover.
* **PCI-DSS Tokenization Vault (`src/tokenization-vault.ts`):** AES-256-GCM envelope encryption, IIN/BIN detection, and ISO/IEC 7812 Luhn validation.
* **EMV 3-D Secure 2 Engine (`src/three-d-secure.ts`):** PSD2 SCA exemption routing (Low-Value, TRA, MIT) and risk scoring.
* **ISO-4217 FX Conversion (`src/fx-conversion.ts`):** Fixed-point `BigInt` multi-currency conversion with deterministic Banker's Rounding.
* **Sliding-Window Velocity Limiter (`src/velocity-limiter.ts`):** Real-time defense against BIN enumeration and automated carding attacks.
* **Distributed Saga Orchestrator (`src/saga-orchestrator.ts`):** Deterministic LIFO compensating transaction runner.
* **ISO-8583 Response Classifier (`src/iso8583-codec.ts`):** Hard vs. soft decline categorization to prevent card network retry penalties.
* **Formal Verification (`specs/PaymentStateMachine.tla`):** TLA+ specification verifying single-capture invariants.

## [1.0.0] - 2026-10-23

### Added
* Initial enterprise production release featuring ACID transaction engine, AVS postal/street risk validation, ISO-3166 normalization, cryptographic idempotency, and statistical Z-score anomaly detection.

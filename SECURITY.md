# Security Policy & Cryptographic Compliance

## Supported Versions

Only the latest minor release on the `main` branch actively receives cryptographic and transactional security patches.

| Version | Supported          | Compliance Level                  |
| ------- | ------------------ | --------------------------------- |
| 1.0.x   | :white_check_mark: | PCI-DSS SAQ-A / ACID Verified     |
| < 1.0   | :x:                | Deprecated                        |

## Core Security Invariants

1. **Zero Raw PAN Storage:** `checkout-core` never logs, caches, or persists raw Primary Account Numbers (PAN) or CVV/CVC data. Card tokenization is strictly delegated to PCI-DSS Level 1 providers (Stripe / Adyen).
2. **Cryptographic Idempotency:** All transactional mutation requests are fingerprinted via canonical `SHA-256` payload hashing to prevent replay attacks, race conditions (`409 Conflict`), and parameter tampering (`422 Unprocessable Entity`).
3. **Atomic Two-Phase Commit (2PC):** Ledger state transitions enforce strict Write-Ahead Logging (`PREPARED` -> `COMMITTED` / `ABORTED`) to eliminate partial state corruption during gateway failovers.
4. **Strict Minor-Unit Arithmetic:** All monetary computations operate exclusively on integer minor units (e.g., cents) to eliminate IEEE-754 floating-point rounding vulnerabilities.

## Reporting a Vulnerability

Please **do not** open a public GitHub issue for suspected security vulnerabilities, idempotency bypasses, or ledger race conditions.

* **Disclosure Channel:** Report privately via GitHub Security Advisories under the repository's **Security** tab.
* **Response SLA:** Initial triage within **24 hours**; mitigation patch or CVE assessment within **72 hours**.

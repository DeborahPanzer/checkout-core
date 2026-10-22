# 💳 Checkout Core & Transaction Engine

[![Checkout Core CI & Compliance Suite](https://github.com/DeborahPanzer/checkout-core/actions/workflows/ci.yml/badge.svg)](https://github.com/DeborahPanzer/checkout-core/actions)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Architecture](https://img.shields.io/badge/Architecture-Two_Phase_Commit_%7C_Saga-emerald)](ARCHITECTURE.md)
[![Compliance](https://img.shields.io/badge/Compliance-PCI--DSS_%7C_ISO_3166-purple)](SECURITY.md)
[![Runtime](https://img.shields.io/badge/Runtime-TypeScript_%2F_Node.js-informational)](package.json)

**`checkout-core`** is an enterprise-grade, high-reliability transactional payment processing engine engineered for strict financial compliance, zero-sum double-entry accounting, and fault-tolerant multi-gateway execution.

---

## 🏛️ Architectural Pillars

```text
[Client Request] ──► [Velocity Tracker / Anomaly Detector] ──► [Idempotency Engine (SHA-256)]
                                                                         │
                                                                         ▼
[Stripe / Adyen Gateway] ◄── [Circuit Breaker / Failover] ◄── [ISO-3166 & AVS Normalizer]
         │
         ▼
[2PC / Saga Orchestrator] ──► [Immutable Hash-Chained Ledger] ──► [Sanitized PCI Audit Logger]
checkout-core/
├── .github/workflows/ci.yml         # Automated TypeScript build & compliance CI matrix
├── src/
│   ├── compliance/                  # ISO-3166 normalizer & AVS address verifier
│   ├── core/                        # Idempotency engine, 2PC, Hash-chained ledger & Circuit breaker
│   ├── logging/                     # PCI-DSS sanitized JSON audit logger
│   ├── resilience/                  # Distributed Saga orchestrator
│   ├── security/                    # Fraud velocity tracker, anomaly detector & token vault
│   ├── settlement/                  # Merchant interchange and fee payout engine
│   ├── webhooks/                    # Constant-time HMAC signature verifier & replay guard
│   ├── services/                    # Core CheckoutService & PricingService (Minor-units)
│   ├── types/                       # Domain DTOs and audit compliance contracts
│   └── index.ts                     # Public API barrel export
├── tests/
│   └── checkout.test.js             # Zero-dependency native Node.js compliance test suite
├── ARCHITECTURE.md                  # Formal mathematical invariants and system specs
├── BENCHMARK.md                     # High-throughput concurrency & latency performance benchmarks
└── SECURITY.md                      # Vulnerability reporting and cryptographic security policy

# Clone the repository
git clone [https://github.com/DeborahPanzer/checkout-core.git](https://github.com/DeborahPanzer/checkout-core.git)
cd checkout-core

# Install dependencies and TypeScript compiler
npm install
npm install --save-dev typescript @types/node

# Compile TypeScript engine
npx tsc --project tsconfig.json

# Run compliance test suite
node --test tests/checkout.test.js
import { CheckoutService } from './src/index';

const checkoutService = new CheckoutService();

const session = checkoutService.processCheckout({
  customer: {
    name: 'Alice Vance',
    email: 'alice.vance@example.com',
    phone: '+12125550199',
  },
  shippingAddress: {
    address: '350 Fifth Avenue',
    city: 'New York',
    state: 'NY',
    postalCode: '10118',
    country: 'USA',
  },
  shippingMethod: 'express',
  paymentMethod: 'stripe_card',
  couponCode: 'WELCOME10',
  items: [{ productId: 'product-001', quantity: 2 }],
  currency: 'USD',
  idempotencyKey: 'idem_prod_998877',
});

console.log('Checkout Authorized:', session);

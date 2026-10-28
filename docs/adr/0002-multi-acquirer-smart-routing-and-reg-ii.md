# ADR 0002: Multi-Acquirer Smart Routing & US Regulation II Debit Optimization

* **Status:** Accepted
* **Date:** 2026-10-28
* **Deciders:** Deborah Panzer (Principal Payment Systems Architect)

## Context and Problem Statement

Relying on a single payment acquirer introduces single points of failure during regional switch outages and prevents optimization of interchange fees under the US Federal Reserve Regulation II (Durbin Amendment) mandate for dual-network debit routing.

## Decision Outcome

We implement a two-tier **Smart Routing & Circuit-Breaking Pipeline**:

1. **Health-First Isolation (`src/circuit-breaker.ts`):**
   Acquirers exhibiting consecutive timeouts transition immediately to `OPEN` state, shifting traffic to secondary processors with zero manual intervention.
2. **Conversion vs. Least-Cost Scoring (`src/bin-routing-table.ts` & `src/interchange-plus.ts`):**
   Eligible US debit BINs are evaluated across both global schemes (Visa/Mastercard) and single-message PINless debit networks (`STAR`, `NYCE`, `PULSE`, `ACCEL`) using weighted scoring across historical authorization rate and basis-point interchange cost.

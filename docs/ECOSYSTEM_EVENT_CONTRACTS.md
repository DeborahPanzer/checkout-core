# Unified Payment Mesh — Cross-Repository Event Contracts (`v1.2.0`)

`checkout-core` operates as the **Edge Authorization, Tokenization & Smart Acquiring Engine** within a four-service financial core architecture:

```text
+-------------------+   FinancialEventEnvelope   +-------------------+
|   checkout-core   | -------------------------> |   ledger-vault    |
| (Edge Auth & FX)  |                            | (Serializable CoA)|
+-------------------+                            +-------------------+
          |                                                ^
          | Capture Cap & FX Pin                           | Settlement & Clawback
          v                                                v
+-------------------+   Reserve Clawback Hook    +-------------------+
|   refund-guard    | -------------------------> |   payout-engine   |
| (Disputes & CE3)  |                            | (2PC Multi-Rail)  |
+-------------------+                            +-------------------+

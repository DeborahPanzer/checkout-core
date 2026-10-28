# PCI-DSS v4.0.1 Architectural Control Matrix

This matrix maps the cryptographic and transactional controls implemented in `checkout-core` directly to **Payment Card Industry Data Security Standard (PCI-DSS) v4.0.1** requirements.

| PCI-DSS v4.0.1 Requirement | Control Objective | Implementing Module | Technical Mechanism |
| :--- | :--- | :--- | :--- |
| **Req 3.5.1** | Render Primary Account Numbers (PAN) unreadable anywhere it is stored | `src/tokenization-vault.ts` | Authenticated **AES-256-GCM** envelope encryption with 96-bit CSPRNG initialization vectors and **HMAC-SHA256** blind indexing. |
| **Req 4.2.1** | Protect cardholder data with strong cryptography during transmission | `src/network-token-cryptogram.ts` | EMVCo network tokenization (DPAN) with dynamic per-transaction **TAVV cryptogram** verification. |
| **Req 6.4.2** | Automated technical solution to detect and prevent web-based and enumeration attacks | `src/velocity-limiter.ts` | Sliding-window velocity limiting across IP hashes, card fingerprints, and IIN/BIN ranges to block automated card testing. |
| **Req 8.3.1** | Strong Customer Authentication (SCA) and risk-based verification | `src/three-d-secure.ts` | EMV **3-D Secure 2 (3DS2)** risk scoring, PSD2 SCA exemption routing, and AVS postal/street validation. |
| **Req 10.3.4** | File and audit log integrity protection against unauthorized modification | `src/merkle-audit.ts` | Append-only **SHA-256 Merkle tree** settlement batch roots and $O(\log N)$ cryptographic inclusion proofs. |

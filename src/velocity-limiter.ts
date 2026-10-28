export interface VelocityCheckRequest {
  readonly cardFingerprint: string;
  readonly binPrefix: string;
  readonly clientIpHash: string;
  readonly timestampMs: number;
}

export interface VelocityRuleConfig {
  readonly windowMs: number;
  readonly maxAttemptsPerCard: number;
  readonly maxAttemptsPerIp: number;
  readonly maxDistinctCardsPerIp: number;
}

export interface VelocityVerdict {
  readonly allowed: boolean;
  readonly violationCode?: "CARD_VELOCITY_EXCEEDED" | "IP_VELOCITY_EXCEEDED" | "BIN_ENUMERATION_DETECTED";
  readonly retryAfterMs: number;
}

export class SlidingWindowVelocityLimiter {
  private readonly cardTimestamps = new Map<string, number[]>();
  private readonly ipTimestamps = new Map<string, number[]>();
  private readonly ipDistinctCards = new Map<string, Map<string, number>>();

  constructor(private readonly config: VelocityRuleConfig) {}

  public evaluate(req: VelocityCheckRequest): VelocityVerdict {
    const cutoff = req.timestampMs - this.config.windowMs;

    const cardHistory = this.pruneAndRecord(this.cardTimestamps, req.cardFingerprint, cutoff, req.timestampMs);
    if (cardHistory.length > this.config.maxAttemptsPerCard) {
      const oldest = cardHistory[0] ?? req.timestampMs;
      return {
        allowed: false,
        violationCode: "CARD_VELOCITY_EXCEEDED",
        retryAfterMs: Math.max(0, oldest + this.config.windowMs - req.timestampMs),
      };
    }

    const ipHistory = this.pruneAndRecord(this.ipTimestamps, req.clientIpHash, cutoff, req.timestampMs);
    if (ipHistory.length > this.config.maxAttemptsPerIp) {
      const oldest = ipHistory[0] ?? req.timestampMs;
      return {
        allowed: false,
        violationCode: "IP_VELOCITY_EXCEEDED",
        retryAfterMs: Math.max(0, oldest + this.config.windowMs - req.timestampMs),
      };
    }

    const distinctCount = this.recordDistinctCardPerIp(req.clientIpHash, req.cardFingerprint, cutoff, req.timestampMs);
    if (distinctCount > this.config.maxDistinctCardsPerIp) {
      return {
        allowed: false,
        violationCode: "BIN_ENUMERATION_DETECTED",
        retryAfterMs: this.config.windowMs,
      };
    }

    return { allowed: true, retryAfterMs: 0 };
  }

  private pruneAndRecord(
    store: Map<string, number[]>,
    key: string,
    cutoff: number,
    nowMs: number
  ): number[] {
    const existing = store.get(key) ?? [];
    const active = existing.filter((ts) => ts > cutoff);
    active.push(nowMs);
    store.set(key, active);
    return active;
  }

  private recordDistinctCardPerIp(
    ipHash: string,
    cardFingerprint: string,
    cutoff: number,
    nowMs: number
  ): number {
    let cardMap = this.ipDistinctCards.get(ipHash);
    if (!cardMap) {
      cardMap = new Map<string, number>();
      this.ipDistinctCards.set(ipHash, cardMap);
    }

    for (const [fp, seenAt] of cardMap.entries()) {
      if (seenAt <= cutoff) {
        cardMap.delete(fp);
      }
    }

    cardMap.set(cardFingerprint, nowMs);
    return cardMap.size;
  }
}

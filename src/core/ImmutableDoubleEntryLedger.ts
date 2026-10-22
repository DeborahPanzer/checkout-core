import * as crypto from 'crypto';

export interface PostingLine {
  accountId: string;
  direction: 'DEBIT' | 'CREDIT';
  amountMinor: number;
}

export interface JournalEntry {
  sequence: number;
  journalId: string;
  orderId: string;
  currency: string;
  lines: ReadonlyArray<PostingLine>;
  previousHash: string;
  entryHash: string;
  recordedAt: string;
}

/**
 * Append-only, cryptographically hash-chained double-entry financial ledger.
 * Guarantees zero-sum conservation of money and tamper-evident auditability.
 */
export class ImmutableDoubleEntryLedger {
  private static readonly GENESIS_HASH = '0'.repeat(64);
  private readonly chain: JournalEntry[] = [];

  public recordBalancedTransfer(
    orderId: string,
    currency: string,
    debitAccount: string,
    creditAccount: string,
    amountMinor: number
  ): JournalEntry {
    return this.appendJournal(orderId, currency, [
      { accountId: debitAccount, direction: 'DEBIT', amountMinor },
      { accountId: creditAccount, direction: 'CREDIT', amountMinor },
    ]);
  }

  public appendJournal(orderId: string, currency: string, lines: PostingLine[]): JournalEntry {
    if (lines.length < 2) {
      throw new Error('Double-Entry Invariant Violation: Journal entry requires at least two posting lines.');
    }

    let totalDebit = 0;
    let totalCredit = 0;

    for (const line of lines) {
      if (!Number.isInteger(line.amountMinor) || line.amountMinor <= 0) {
        throw new Error(
          `Ledger Precision Violation: Posting amount for '${line.accountId}' must be a positive integer.`
        );
      }
      if (line.direction === 'DEBIT') {
        totalDebit += line.amountMinor;
      } else {
        totalCredit += line.amountMinor;
      }
    }

    if (totalDebit !== totalCredit) {
      throw new Error(
        `Zero-Sum Invariant Violation: Unbalanced journal (Debits=${totalDebit}, Credits=${totalCredit}).`
      );
    }

    const sequence = this.chain.length + 1;
    const previousHash =
      this.chain.length === 0
        ? ImmutableDoubleEntryLedger.GENESIS_HASH
        : this.chain[this.chain.length - 1].entryHash;

    const journalId = `jrn_${crypto.randomBytes(8).toString('hex')}`;
    const recordedAt = new Date().toISOString();
    const frozenLines = Object.freeze(lines.map((l) => Object.freeze({ ...l })));

    const entryHash = this.computeEntryHash({
      sequence,
      journalId,
      orderId,
      currency,
      lines: frozenLines,
      previousHash,
      recordedAt,
    });

    const entry: JournalEntry = Object.freeze({
      sequence,
      journalId,
      orderId,
      currency,
      lines: frozenLines,
      previousHash,
      entryHash,
      recordedAt,
    });

    this.chain.push(entry);
    return entry;
  }

  public verifyChainIntegrity(): boolean {
    for (let i = 0; i < this.chain.length; i++) {
      const current = this.chain[i];
      const expectedPrev =
        i === 0 ? ImmutableDoubleEntryLedger.GENESIS_HASH : this.chain[i - 1].entryHash;

      if (current.previousHash !== expectedPrev) {
        return false;
      }

      const recalculated = this.computeEntryHash({
        sequence: current.sequence,
        journalId: current.journalId,
        orderId: current.orderId,
        currency: current.currency,
        lines: current.lines,
        previousHash: current.previousHash,
        recordedAt: current.recordedAt,
      });

      if (current.entryHash !== recalculated) {
        return false;
      }
    }
    return true;
  }

  public getSnapshot(): ReadonlyArray<JournalEntry> {
    return [...this.chain];
  }

  private computeEntryHash(payload: Omit<JournalEntry, 'entryHash'>): string {
    const canonical = JSON.stringify({
      seq: payload.sequence,
      id: payload.journalId,
      ord: payload.orderId,
      cur: payload.currency,
      lines: payload.lines,
      prev: payload.previousHash,
      ts: payload.recordedAt,
    });
    return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
  }
}

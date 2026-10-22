export type LogSeverity = 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL_AUDIT';

export interface AuditLogEntry {
  timestamp: string;
  severity: LogSeverity;
  event: string;
  payload: Record<string, unknown>;
}

/**
 * PCI-DSS compliant structured JSON audit logger with automated PII and card number sanitization.
 */
export class SanitizedAuditLogger {
  public log(severity: LogSeverity, event: string, rawPayload: Record<string, unknown>): AuditLogEntry {
    const sanitizedPayload = this.deepSanitize(rawPayload);
    const entry: AuditLogEntry = {
      timestamp: new Date().toISOString(),
      severity,
      event,
      payload: sanitizedPayload,
    };

    // In production, this pipes to secure stdout/stderr or append-only log streams
    return entry;
  }

  private deepSanitize(obj: Record<string, unknown>): Record<string, unknown> {
    const clone: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      if (lowerKey.includes('pan') || lowerKey.includes('card') || lowerKey.includes('cvv') || lowerKey.includes('password')) {
        clone[key] = '[REDACTED_PCI_SENSITIVE]';
      } else if (lowerKey.includes('email') && typeof value === 'string') {
        clone[key] = this.maskEmail(value);
      } else if (lowerKey.includes('phone') && typeof value === 'string') {
        clone[key] = '[REDACTED_PHONE]';
      } else if (value !== null && typeof value === 'object') {
        clone[key] = this.deepSanitize(value as Record<string, unknown>);
      } else {
        clone[key] = value;
      }
    }

    return clone;
  }

  private maskEmail(email: string): string {
    const parts = email.split('@');
    if (parts.length !== 2) return '***@***.***';
    const name = parts[0];
    const maskedName = name.length <= 2 ? '***' : `${name.slice(0, 2)}***`;
    return `${maskedName}@${parts[1]}`;
  }
}

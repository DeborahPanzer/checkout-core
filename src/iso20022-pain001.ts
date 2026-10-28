export interface Iso20022CreditTransferInstruction {
  readonly messageId: string;
  readonly endToEndId: string;
  readonly creationTimestampIso: string;
  readonly initiatingPartyName: string;
  readonly debtorIban: string;
  readonly creditorName: string;
  readonly creditorIban: string;
  readonly amountMinorUnits: bigint;
  readonly currency: "USD" | "EUR" | "GBP";
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function formatMinorUnitsDecimal(amountMinor: bigint): string {
  if (amountMinor <= 0n) {
    throw new Error("ISO20022_ERR: Credit transfer amount must be strictly positive");
  }
  const major = amountMinor / 100n;
  const minor = (amountMinor % 100n).toString().padStart(2, "0");
  return `${major.toString()}.${minor}`;
}

export function buildIso20022Pain001Xml(instr: Iso20022CreditTransferInstruction): string {
  const formattedAmount = formatMinorUnitsDecimal(instr.amountMinorUnits);

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.09">`,
    `  <CstmrCdtTrfInitn>`,
    `    <GrpHdr>`,
    `      <MsgId>${escapeXml(instr.messageId)}</MsgId>`,
    `      <CreDtTm>${escapeXml(instr.creationTimestampIso)}</CreDtTm>`,
    `      <NbOfTxs>1</NbOfTxs>`,
    `      <CtrlSum>${formattedAmount}</CtrlSum>`,
    `      <InitgPty><Nm>${escapeXml(instr.initiatingPartyName)}</Nm></InitgPty>`,
    `    </GrpHdr>`,
    `    <PmtInf>`,
    `      <PmtInfId>${escapeXml(instr.endToEndId)}</PmtInfId>`,
    `      <PmtMtd>TRF</PmtMtd>`,
    `      <DbtrAcct><Id><IBAN>${escapeXml(instr.debtorIban)}</IBAN></Id></DbtrAcct>`,
    `      <CdtTrfTxInf>`,
    `        <PmtId><EndToEndId>${escapeXml(instr.endToEndId)}</EndToEndId></PmtId>`,
    `        <Amt><InstdAmt Ccy="${instr.currency}">${formattedAmount}</InstdAmt></Amt>`,
    `        <Cdtr><Nm>${escapeXml(instr.creditorName)}</Nm></Cdtr>`,
    `        <CdtrAcct><Id><IBAN>${escapeXml(instr.creditorIban)}</IBAN></Id></CdtrAcct>`,
    `      </CdtTrfTxInf>`,
    `    </PmtInf>`,
    `  </CstmrCdtTrfInitn>`,
    `</Document>`,
  ].join("\n");
}

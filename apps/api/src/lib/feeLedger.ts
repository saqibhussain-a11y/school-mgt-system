import { FeeInvoiceStatus } from "@sms/db";

export function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

interface LedgerPayment {
  amountPaid: number;
  refunds: { amount: number }[];
}

interface LedgerInvoice {
  netAmount: number;
  payments: LedgerPayment[];
}

// balance/effectivePaid are always derived from the payments+refunds ledger,
// never stored — status IS persisted (recomputed on every write) so list
// queries (defaulter reports) don't need to join+sum for every row. balance
// is clamped at 0 — an overpayment doesn't make an invoice "owe negative
// money", it mints fee credit instead (see creditPoolFor below).
export function ledgerFor(invoice: LedgerInvoice) {
  const totalPaid = invoice.payments.reduce((sum, p) => sum + p.amountPaid, 0);
  const totalRefunded = invoice.payments.reduce(
    (sum, p) => sum + p.refunds.reduce((s, r) => s + r.amount, 0),
    0,
  );
  const effectivePaid = roundMoney(totalPaid - totalRefunded);
  const balance = Math.max(0, roundMoney(invoice.netAmount - effectivePaid));
  return { effectivePaid, balance };
}

export function statusFor(netAmount: number, effectivePaid: number): FeeInvoiceStatus {
  const roundedNet = roundMoney(netAmount);
  const roundedPaid = roundMoney(effectivePaid);
  if (roundedPaid >= roundedNet) return FeeInvoiceStatus.PAID;
  if (roundedPaid > 0) return FeeInvoiceStatus.PARTIALLY_PAID;
  return FeeInvoiceStatus.UNPAID;
}

interface CreditLedgerPayment extends LedgerPayment {
  paymentMethod: "MANUAL" | "CREDIT";
}

interface CreditLedgerInvoice {
  netAmount: number;
  payments: CreditLedgerPayment[];
}

// A student's available fee credit is entirely derived, never stored:
//   minted   = how much every invoice has, right now, been overpaid by
//   consumed = how much has, right now, actually been spent as CREDIT-method
//              payments elsewhere
// Both terms are recomputed from current ledger state on every call, so a
// refund on the overpaying payment shrinks `minted` immediately, and a
// refund on a credit-funded payment shrinks `consumed` immediately — the
// pool self-corrects instead of needing a separate ledger to keep in sync.
export function creditPoolFor(invoices: CreditLedgerInvoice[]): number {
  let minted = 0;
  let consumed = 0;
  for (const invoice of invoices) {
    const { effectivePaid } = ledgerFor(invoice);
    minted += Math.max(0, roundMoney(effectivePaid - invoice.netAmount));
    for (const payment of invoice.payments) {
      if (payment.paymentMethod !== "CREDIT") continue;
      const refunded = payment.refunds.reduce((sum, r) => sum + r.amount, 0);
      consumed += roundMoney(payment.amountPaid - refunded);
    }
  }
  return roundMoney(minted - consumed);
}

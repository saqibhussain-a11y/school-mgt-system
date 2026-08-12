import { describe, expect, it } from "vitest";
import { FeeInvoiceStatus } from "@sms/db";
import { creditPoolFor, ledgerFor, roundMoney, statusFor } from "./feeLedger";

describe("ledgerFor", () => {
  it("computes effectivePaid and balance for an unpaid invoice", () => {
    const result = ledgerFor({ netAmount: 500, payments: [] });
    expect(result).toEqual({ effectivePaid: 0, balance: 500 });
  });

  it("subtracts refunds from the paid amount", () => {
    const result = ledgerFor({
      netAmount: 500,
      payments: [{ amountPaid: 500, refunds: [{ amount: 100 }] }],
    });
    expect(result).toEqual({ effectivePaid: 400, balance: 100 });
  });

  it("clamps balance at 0 for an overpayment, never goes negative", () => {
    const result = ledgerFor({
      netAmount: 500,
      payments: [{ amountPaid: 700, refunds: [] }],
    });
    expect(result.balance).toBe(0);
    expect(result.effectivePaid).toBe(700);
  });
});

describe("statusFor", () => {
  it("is UNPAID when nothing has been paid", () => {
    expect(statusFor(500, 0)).toBe(FeeInvoiceStatus.UNPAID);
  });

  it("is PARTIALLY_PAID for a partial payment", () => {
    expect(statusFor(500, 200)).toBe(FeeInvoiceStatus.PARTIALLY_PAID);
  });

  it("is PAID once the paid amount reaches or exceeds net", () => {
    expect(statusFor(500, 500)).toBe(FeeInvoiceStatus.PAID);
    expect(statusFor(500, 700)).toBe(FeeInvoiceStatus.PAID);
  });

  it("does not misclassify due to floating-point rounding", () => {
    // 0.1 + 0.2 !== 0.3 in IEEE 754 — this invoice is fully paid in three
    // 100.10 installments (300.30 total) and must not read as PARTIALLY_PAID.
    expect(statusFor(300.3, 100.1 + 100.1 + 100.1)).toBe(FeeInvoiceStatus.PAID);
  });
});

describe("creditPoolFor — the fee credit-carry invariant", () => {
  it("is 0 when nothing has been overpaid", () => {
    expect(creditPoolFor([{ netAmount: 500, payments: [] }])).toBe(0);
  });

  it("mints credit equal to the overpaid amount", () => {
    const pool = creditPoolFor([
      { netAmount: 500, payments: [{ amountPaid: 700, refunds: [], paymentMethod: "MANUAL" }] },
    ]);
    expect(pool).toBe(200);
  });

  it("shrinks minted credit immediately when the overpaying payment is refunded", () => {
    const pool = creditPoolFor([
      {
        netAmount: 500,
        payments: [{ amountPaid: 700, refunds: [{ amount: 200 }], paymentMethod: "MANUAL" }],
      },
    ]);
    // effectivePaid is back down to 500 — exactly netAmount, no overpayment left.
    expect(pool).toBe(0);
  });

  it("subtracts credit already spent (CREDIT-method payments) across other invoices", () => {
    const pool = creditPoolFor([
      // Invoice A: overpaid by 200 — mints 200 of credit.
      { netAmount: 500, payments: [{ amountPaid: 700, refunds: [], paymentMethod: "MANUAL" }] },
      // Invoice B: 150 of that credit already spent on it.
      { netAmount: 300, payments: [{ amountPaid: 150, refunds: [], paymentMethod: "CREDIT" }] },
    ]);
    expect(pool).toBe(50);
  });

  it("restores spent credit immediately when a CREDIT-funded payment is refunded", () => {
    const pool = creditPoolFor([
      { netAmount: 500, payments: [{ amountPaid: 700, refunds: [], paymentMethod: "MANUAL" }] },
      {
        netAmount: 300,
        payments: [{ amountPaid: 150, refunds: [{ amount: 150 }], paymentMethod: "CREDIT" }],
      },
    ]);
    // The 150 CREDIT payment was fully refunded, so it no longer counts as
    // "consumed" — the full 200 minted from invoice A is available again.
    expect(pool).toBe(200);
  });
});

describe("roundMoney", () => {
  it("rounds to 2 decimal places, fixing float drift", () => {
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
    expect(roundMoney(19.999999)).toBe(20);
  });
});

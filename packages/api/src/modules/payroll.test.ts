import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";

import {
  assertNoDuplicateActivePayrollLabel,
  calculateAnnualTotals,
  calculatePayrollTotals,
  fixedPayrollFields,
  formatPaiseAsMoney,
  getFinancialYearMonths,
  parseMoneyToPaise,
} from "./payroll";

describe("Payroll money helpers", () => {
  it("parses and formats paise without floating point drift", () => {
    expect(parseMoneyToPaise("1234.50")).toBe(123_450);
    expect(parseMoneyToPaise("10.5")).toBe(1_050);
    expect(formatPaiseAsMoney(123_450)).toBe("1234.50");
  });

  it("rejects invalid or negative money input", () => {
    expect(() => parseMoneyToPaise("-1")).toThrow(TRPCError);
    expect(() => parseMoneyToPaise("1.999")).toThrow(TRPCError);
    expect(() => parseMoneyToPaise("abc")).toThrow(TRPCError);
  });
});

describe("Payroll financial year helpers", () => {
  it("generates April through March for a financial year", () => {
    const months = getFinancialYearMonths(2026);

    expect(months).toHaveLength(12);
    expect(months[0]).toMatchObject({
      value: "2026-04",
      monthIndex: 3,
      year: 2026,
    });
    expect(months[11]).toMatchObject({
      value: "2027-03",
      monthIndex: 2,
      year: 2027,
    });
  });
});

describe("Payroll field ordering and totals", () => {
  it("keeps fixed earning and deduction field order", () => {
    expect(fixedPayrollFields.earnings.map((field) => field.label)).toEqual([
      "Basic Pay",
      "D.A.",
      "D.A. Difference Arrears",
      "HRA",
      "C.L.A",
      "V.A/T.A. Arrear",
    ]);
    expect(fixedPayrollFields.deductions.map((field) => field.label)).toEqual([
      "Recovery",
      "G.P.F",
      "R.D",
      "C.M. Fund",
      "Income Tax / TDS",
      "Professional Tax",
      "L.I.C",
    ]);
  });

  it("calculates monthly and annual totals from paise", () => {
    const monthlyTotals = calculatePayrollTotals([
      { section: "earnings", amountPaise: 100_25 },
      { section: "earnings", amountPaise: 200_25 },
      { section: "deductions", amountPaise: 50_10 },
    ]);

    expect(monthlyTotals).toEqual({
      earningsPaise: 300_50,
      deductionsPaise: 50_10,
      netPayPaise: 250_40,
    });
    expect(calculateAnnualTotals(monthlyTotals)).toEqual({
      earningsPaise: 3_606_00,
      deductionsPaise: 601_20,
      netPayPaise: 3_004_80,
    });
  });
});

describe("Payroll custom field validation", () => {
  it("rejects duplicate active labels in the same section", () => {
    expect(() =>
      assertNoDuplicateActivePayrollLabel(
        [
          { label: "Special Allowance", section: "earnings", isActive: true },
          { label: "Special Allowance", section: "deductions", isActive: true },
        ],
        "earnings",
        " special allowance ",
      ),
    ).toThrow("A payroll field with this label already exists in this section");
  });

  it("allows matching labels in different sections or archived fields", () => {
    expect(() =>
      assertNoDuplicateActivePayrollLabel(
        [
          { label: "Special Allowance", section: "deductions", isActive: true },
          { label: "Old Allowance", section: "earnings", isActive: false },
        ],
        "earnings",
        "Special Allowance",
      ),
    ).not.toThrow();
  });
});

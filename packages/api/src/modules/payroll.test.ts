import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";

import { payrollEmployeeFormSchema } from "../schemas/payroll";

import {
  assertNoDuplicateActivePayrollLabel,
  calculatePayrollTotals,
  fixedPayrollFields,
  formatPaiseAsMoney,
  filterSavedLineItemsForCustomFieldPeriods,
  getFinancialYearMonths,
  getInitialPayrollEffectiveMonths,
  parseMoneyToPaise,
  resolvePayrollVersionForMonth,
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

  it("resolves the latest payroll version without crossing later changes", () => {
    const versions = [
      { id: "april", effectiveMonth: "2026-04" },
      { id: "june", effectiveMonth: "2026-06" },
      { id: "september", effectiveMonth: "2026-09" },
    ];

    expect(resolvePayrollVersionForMonth(versions, "2026-05")?.id).toBe("april");
    expect(resolvePayrollVersionForMonth(versions, "2026-08")?.id).toBe("june");
    expect(resolvePayrollVersionForMonth(versions, "2026-09")?.id).toBe("september");
    expect(resolvePayrollVersionForMonth(versions, "2026-03")).toBeNull();
  });

  it("rejects a payroll month outside the selected financial year", () => {
    expect(
      payrollEmployeeFormSchema.safeParse({
        employeeId: "employee-1",
        financialYearStart: 2026,
        month: "2027-04",
      }).success,
    ).toBe(false);
    expect(
      payrollEmployeeFormSchema.safeParse({
        employeeId: "employee-1",
        financialYearStart: 2026,
        month: "2027-03",
      }).success,
    ).toBe(true);
  });

  it("backfills a first save to April without backdating newer custom fields", () => {
    expect(
      getInitialPayrollEffectiveMonths({
        financialYearStart: 2026,
        selectedMonth: "2026-09",
        activeCustomFieldIds: ["june-field", "september-field"],
        periods: [
          {
            customFieldDefinitionId: "june-field",
            effectiveFromMonth: "2026-06",
            effectiveToMonth: null,
          },
          {
            customFieldDefinitionId: "september-field",
            effectiveFromMonth: "2026-09",
            effectiveToMonth: null,
          },
        ],
      }),
    ).toEqual(["2026-04", "2026-06", "2026-09"]);
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

  it("calculates monthly totals from paise", () => {
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
  });
});

describe("Payroll custom field validation", () => {
  it("does not restore an employee's old amount when a field is reactivated", () => {
    const savedLineItems = [
      {
        id: "old-value",
        section: "earnings" as const,
        fixedFieldKey: null,
        customFieldDefinitionId: "allowance",
        label: "Allowance",
        amountPaise: 5_000,
        sortOrder: 1001,
      },
    ];

    expect(
      filterSavedLineItemsForCustomFieldPeriods({
        savedLineItems,
        versionEffectiveMonth: "2026-04",
        month: "2026-12",
        periods: [
          {
            customFieldDefinitionId: "allowance",
            effectiveFromMonth: "2026-04",
            effectiveToMonth: "2026-09",
          },
          {
            customFieldDefinitionId: "allowance",
            effectiveFromMonth: "2026-12",
            effectiveToMonth: null,
          },
        ],
      }),
    ).toEqual([]);
  });

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

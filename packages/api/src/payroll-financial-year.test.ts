import { describe, expect, it } from "vitest";

import {
  containsPayrollMonth,
  getCurrentPayrollFinancialYearStart,
  getDefaultPayrollMonth,
  getPayrollFinancialYearLabel,
  getPayrollFinancialYearMonths,
  isPayrollFinancialYearStart,
  payrollFinancialYearStartValues,
} from "./payroll-financial-year";

describe("Payroll Financial Year", () => {
  it("keeps the supported start years in one stable declaration", () => {
    expect(payrollFinancialYearStartValues).toHaveLength(6);
    expect(payrollFinancialYearStartValues[0]).toBe(2023);
    expect(payrollFinancialYearStartValues.at(-1)).toBe(2028);
    expect(isPayrollFinancialYearStart(2023)).toBe(true);
    expect(isPayrollFinancialYearStart(2028)).toBe(true);
    expect(isPayrollFinancialYearStart(2022)).toBe(false);
    expect(isPayrollFinancialYearStart("2026")).toBe(false);
  });

  it("includes April through March and rejects outside or malformed months", () => {
    expect(containsPayrollMonth(2026, "2026-04")).toBe(true);
    expect(containsPayrollMonth(2026, "2027-03")).toBe(true);
    expect(containsPayrollMonth(2026, "2026-03")).toBe(false);
    expect(containsPayrollMonth(2026, "2027-04")).toBe(false);
    expect(containsPayrollMonth(2026, "2026-13")).toBe(false);
  });

  it("generates 12 ordered months with stable UTC labels across rollover", () => {
    const months = getPayrollFinancialYearMonths(2026);

    expect(months).toHaveLength(12);
    expect(months[0]).toEqual({
      value: "2026-04",
      label: "April 2026",
      shortLabel: "Apr 2026",
      year: 2026,
      monthIndex: 3,
    });
    expect(months[8]?.value).toBe("2026-12");
    expect(months[9]).toEqual({
      value: "2027-01",
      label: "January 2027",
      shortLabel: "Jan 2027",
      year: 2027,
      monthIndex: 0,
    });
    expect(months[11]?.value).toBe("2027-03");
    expect(getPayrollFinancialYearLabel(2026)).toBe("2026-2027");
  });

  it("selects the current start year on the April 1 UTC boundary", () => {
    expect(getCurrentPayrollFinancialYearStart(new Date("2026-03-31T23:59:59.999Z"))).toBe(2025);
    expect(getCurrentPayrollFinancialYearStart(new Date("2026-04-01T00:00:00.000Z"))).toBe(2026);
    expect(getCurrentPayrollFinancialYearStart(new Date("2027-03-31T23:59:59.999Z"))).toBe(2026);
    expect(getCurrentPayrollFinancialYearStart(new Date("2027-04-01T00:00:00.000Z"))).toBe(2027);
  });

  it("uses the current month inside the selected year and April outside it", () => {
    expect(getDefaultPayrollMonth(2026, new Date("2026-04-01T00:00:00.000Z"))).toBe("2026-04");
    expect(getDefaultPayrollMonth(2026, new Date("2027-03-31T23:59:59.999Z"))).toBe("2027-03");
    expect(getDefaultPayrollMonth(2026, new Date("2027-04-01T00:00:00.000Z"))).toBe("2026-04");
  });
});

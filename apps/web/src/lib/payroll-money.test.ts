import { describe, expect, it } from "vitest";

import {
  formatPaiseForDisplay,
  formatPaiseForInput,
  formatPayrollInput,
  normalizePayrollInputForApi,
  parsePayrollInputToPaise,
  removeMoneyGrouping,
} from "./payroll-money";

describe("payroll money formatting", () => {
  it("formats paise with Indian grouping", () => {
    expect(formatPaiseForInput(0)).toBe("");
    expect(formatPaiseForInput(100_000)).toBe("1,000.00");
    expect(formatPaiseForInput(123_456_750)).toBe("12,34,567.50");
    expect(formatPaiseForDisplay(0)).toBe("0.00");
  });

  it("parses plain and grouped values", () => {
    expect(parsePayrollInputToPaise("")).toBe(0);
    expect(parsePayrollInputToPaise("125000")).toBe(12_500_000);
    expect(parsePayrollInputToPaise("1,25,000.5")).toBe(12_500_050);
    expect(parsePayrollInputToPaise("12.345")).toBeNaN();
    expect(parsePayrollInputToPaise("amount")).toBeNaN();
  });

  it("normalizes values for editing, display, and the API", () => {
    expect(removeMoneyGrouping("12,34,567.50")).toBe("1234567.50");
    expect(formatPayrollInput("1234567.5")).toBe("12,34,567.50");
    expect(formatPayrollInput("bad value")).toBe("bad value");
    expect(normalizePayrollInputForApi(" 12,34,567.50 ")).toBe("1234567.50");
  });
});

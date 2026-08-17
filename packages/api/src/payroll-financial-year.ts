export const payrollFinancialYearStartValues = [2023, 2024, 2025, 2026, 2027, 2028] as const;

export type PayrollFinancialYearStart = (typeof payrollFinancialYearStartValues)[number];

const payrollMonthPattern = /^(\d{4})-(0[1-9]|1[0-2])$/;
const longMonthFormatter = new Intl.DateTimeFormat("en-IN", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const shortMonthFormatter = new Intl.DateTimeFormat("en-IN", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function isPayrollFinancialYearStart(value: unknown): value is PayrollFinancialYearStart {
  return (
    typeof value === "number" &&
    payrollFinancialYearStartValues.includes(value as PayrollFinancialYearStart)
  );
}

export function containsPayrollMonth(financialYearStart: number, yyyyMm: string) {
  const match = payrollMonthPattern.exec(yyyyMm);

  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);

  return (
    (year === financialYearStart && month >= 4) || (year === financialYearStart + 1 && month <= 3)
  );
}

export function getPayrollFinancialYearMonths(financialYearStart: number) {
  return Array.from({ length: 12 }, (_, index) => {
    const monthIndex = (3 + index) % 12;
    const year = index < 9 ? financialYearStart : financialYearStart + 1;
    const date = new Date(Date.UTC(year, monthIndex, 1));

    return {
      value: `${year}-${String(monthIndex + 1).padStart(2, "0")}`,
      label: longMonthFormatter.format(date),
      shortLabel: shortMonthFormatter.format(date),
      year,
      monthIndex,
    };
  });
}

export function getPayrollFinancialYearLabel(financialYearStart: number) {
  return `${financialYearStart}-${financialYearStart + 1}`;
}

export function getCurrentPayrollFinancialYearStart(date = new Date()): PayrollFinancialYearStart {
  const year = date.getUTCFullYear();
  const monthIndex = date.getUTCMonth();
  const financialYearStart = monthIndex >= 3 ? year : year - 1;

  return isPayrollFinancialYearStart(financialYearStart)
    ? financialYearStart
    : payrollFinancialYearStartValues[0];
}

export function getDefaultPayrollMonth(financialYearStart: number, date = new Date()) {
  const currentMonth = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  return containsPayrollMonth(financialYearStart, currentMonth)
    ? currentMonth
    : `${financialYearStart}-04`;
}

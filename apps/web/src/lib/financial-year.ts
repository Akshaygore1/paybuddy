export const financialYearOptions = [
  2023, 2024, 2025, 2026, 2027, 2028,
] as const;
export const financialYearStorageKey = "paybuddy:selectedFinancialYearStart";
export const financialYearChangeEvent = "paybuddy:financial-year-change";

export type FinancialYearStart = (typeof financialYearOptions)[number];

export function getFinancialYearLabel(financialYearStart: number) {
  return `${financialYearStart}-${financialYearStart + 1}`;
}

export function getCurrentFinancialYearStart(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const financialYearStart = month >= 3 ? year : year - 1;

  if (financialYearOptions.includes(financialYearStart as FinancialYearStart)) {
    return financialYearStart as FinancialYearStart;
  }

  return financialYearOptions[0];
}

export function readSelectedFinancialYearStart() {
  if (typeof window === "undefined") {
    return getCurrentFinancialYearStart();
  }

  const storedValue = Number(
    window.localStorage.getItem(financialYearStorageKey),
  );

  if (financialYearOptions.includes(storedValue as FinancialYearStart)) {
    return storedValue as FinancialYearStart;
  }

  return getCurrentFinancialYearStart();
}

export function writeSelectedFinancialYearStart(
  financialYearStart: FinancialYearStart,
) {
  window.localStorage.setItem(
    financialYearStorageKey,
    String(financialYearStart),
  );
  window.dispatchEvent(
    new CustomEvent(financialYearChangeEvent, {
      detail: { financialYearStart },
    }),
  );
}

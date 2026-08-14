import {
  getCurrentPayrollFinancialYearStart,
  isPayrollFinancialYearStart,
  type PayrollFinancialYearStart,
} from "@tds-nivaran/api/payroll-financial-year";

const financialYearStorageKey = "tds-nivaran:selectedFinancialYearStart";
const listeners = new Set<() => void>();
const changeGuards = new Set<(financialYearStart: PayrollFinancialYearStart) => boolean>();
let cachedWindow: Window | undefined;
let cachedFinancialYearStart: PayrollFinancialYearStart | undefined;

export type FinancialYearStart = PayrollFinancialYearStart;

export function getSelectedFinancialYearStart(): PayrollFinancialYearStart {
  if (typeof window === "undefined") {
    return getCurrentPayrollFinancialYearStart();
  }

  if (cachedWindow === window && cachedFinancialYearStart !== undefined) {
    return cachedFinancialYearStart;
  }

  const storedValue = Number(window.localStorage.getItem(financialYearStorageKey));
  cachedWindow = window;
  cachedFinancialYearStart = isPayrollFinancialYearStart(storedValue)
    ? storedValue
    : getCurrentPayrollFinancialYearStart();
  return cachedFinancialYearStart;
}

export function setSelectedFinancialYearStart(financialYearStart: PayrollFinancialYearStart) {
  if (financialYearStart === getSelectedFinancialYearStart()) {
    return true;
  }

  if ([...changeGuards].some((guard) => !guard(financialYearStart))) {
    return false;
  }

  if (typeof window === "undefined") {
    return false;
  }

  window.localStorage.setItem(financialYearStorageKey, String(financialYearStart));
  cachedWindow = window;
  cachedFinancialYearStart = financialYearStart;
  for (const listener of listeners) listener();
  return true;
}

export function subscribeSelectedFinancialYear(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function registerSelectedFinancialYearChangeGuard(
  guard: (financialYearStart: PayrollFinancialYearStart) => boolean,
) {
  changeGuards.add(guard);
  return () => {
    changeGuards.delete(guard);
  };
}

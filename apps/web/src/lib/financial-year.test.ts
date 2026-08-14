import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getSelectedFinancialYearStart,
  registerSelectedFinancialYearChangeGuard,
  setSelectedFinancialYearStart,
  subscribeSelectedFinancialYear,
} from "./financial-year";

describe("Payroll Financial Year browser adapter", () => {
  let storedValue: string | null;
  let getItem: ReturnType<typeof vi.fn>;
  let setItem: ReturnType<typeof vi.fn>;
  const cleanups: Array<() => void> = [];

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-14T00:00:00.000Z"));
    storedValue = null;
    getItem = vi.fn(() => storedValue);
    setItem = vi.fn((_key: string, value: string) => {
      storedValue = value;
    });
    vi.stubGlobal("window", {
      localStorage: {
        getItem,
        setItem,
      },
    });
  });

  afterEach(() => {
    for (const cleanup of cleanups.splice(0)) cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("defaults to the current Payroll Financial Year", () => {
    expect(getSelectedFinancialYearStart()).toBe(2026);
  });

  it("returns a persisted valid selection", () => {
    storedValue = "2024";

    expect(getSelectedFinancialYearStart()).toBe(2024);
    expect(getSelectedFinancialYearStart()).toBe(2024);
    expect(getItem).toHaveBeenCalledOnce();
  });

  it("ignores an invalid persisted selection", () => {
    storedValue = "2035";

    expect(getSelectedFinancialYearStart()).toBe(2026);
  });

  it("persists a change and notifies subscribers", () => {
    const listener = vi.fn();
    cleanups.push(subscribeSelectedFinancialYear(listener));

    expect(setSelectedFinancialYearStart(2025)).toBe(true);

    expect(setItem).toHaveBeenCalledWith("tds-nivaran:selectedFinancialYearStart", "2025");
    expect(listener).toHaveBeenCalledOnce();
    expect(getSelectedFinancialYearStart()).toBe(2025);
  });

  it("cancels a change when a registered guard rejects it", () => {
    const listener = vi.fn();
    cleanups.push(subscribeSelectedFinancialYear(listener));
    cleanups.push(registerSelectedFinancialYearChangeGuard(() => false));

    expect(setSelectedFinancialYearStart(2025)).toBe(false);
    expect(setItem).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
  });

  it("stops notifying an unsubscribed listener", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeSelectedFinancialYear(listener);
    unsubscribe();

    setSelectedFinancialYearStart(2025);

    expect(listener).not.toHaveBeenCalled();
  });

  it("does not persist or notify a same-value selection", () => {
    storedValue = "2025";
    const listener = vi.fn();
    cleanups.push(subscribeSelectedFinancialYear(listener));

    expect(setSelectedFinancialYearStart(2025)).toBe(true);
    expect(setItem).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
  });
});

import { describe, expect, it } from "vitest";

import {
  createPayrollWorkspaceState,
  payrollWorkspaceReducer,
  validatePayrollWorkspace,
} from "./payroll-workspace";

const lineItem = {
  section: "earnings" as const,
  fixedFieldKey: "basicPay",
  customFieldDefinitionId: null,
  label: "Basic Pay",
  amount: "1000.00",
  sortOrder: 1,
};

describe("payroll workspace reducer", () => {
  it("tracks loaded form identity, edits, validation, and discard", () => {
    let state = createPayrollWorkspaceState({ financialYearStart: 2026, month: "2026-04" });
    state = payrollWorkspaceReducer(state, { type: "employeeSelected", employeeId: "employee-1" });
    state = payrollWorkspaceReducer(state, {
      type: "formLoaded",
      identity: { employeeId: "employee-1", financialYearStart: 2026, month: "2026-04" },
      lineItems: [lineItem],
    });
    state = payrollWorkspaceReducer(state, {
      type: "amountChanged",
      lineItemKey: "earnings:fixed:basicPay",
      amount: "invalid",
    });

    expect(state.isDirty).toBe(true);
    expect(validatePayrollWorkspace(state)).toMatchObject({
      hasInvalidAmounts: true,
      canSave: false,
    });

    const restored = payrollWorkspaceReducer(state, {
      type: "amountChanged",
      lineItemKey: "earnings:fixed:basicPay",
      amount: "1000.00",
    });
    expect(restored.isDirty).toBe(false);
    expect(validatePayrollWorkspace(restored).canDownload).toBe(true);

    state = payrollWorkspaceReducer(state, { type: "discarded" });
    expect(state.lineItems[0]?.amount).toBe("1000.00");
    expect(state.isDirty).toBe(false);
  });

  it("clears stale form identity when month, employee, or year changes", () => {
    const loaded = payrollWorkspaceReducer(
      createPayrollWorkspaceState({ financialYearStart: 2026, month: "2026-04" }),
      {
        type: "formLoaded",
        identity: { employeeId: "employee-1", financialYearStart: 2026, month: "2026-04" },
        lineItems: [lineItem],
      },
    );
    expect(
      payrollWorkspaceReducer(loaded, { type: "monthSelected", month: "2026-05" }).loadedForm,
    ).toBeNull();
    expect(
      payrollWorkspaceReducer(loaded, { type: "employeeSelected", employeeId: "employee-2" })
        .loadedForm,
    ).toBeNull();
    expect(
      payrollWorkspaceReducer(loaded, {
        type: "financialYearSelected",
        financialYearStart: 2027,
        month: "2027-04",
      }).loadedForm,
    ).toBeNull();
  });
});

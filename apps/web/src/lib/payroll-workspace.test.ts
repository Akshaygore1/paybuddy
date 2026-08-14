import { describe, expect, it } from "vitest";

import {
  buildPayrollWorkspaceDocument,
  createPayrollWorkspaceState,
  getPayrollWorkspaceView,
  serializePayrollWorkspaceSave,
  transitionPayrollWorkspace,
  type PayrollWorkspaceForm,
} from "./payroll-workspace";

const lineItem = {
  section: "earnings" as const,
  fixedFieldKey: "basicPay",
  customFieldDefinitionId: null,
  label: "Basic Pay",
  amountPaise: 100_000,
  sortOrder: 1,
  isArchivedCustomField: false,
};

function createForm(input: Partial<PayrollWorkspaceForm> = {}): PayrollWorkspaceForm {
  return {
    institution: { name: "TDS Nivaran School", address: "School Road", tanNumber: "TAN123" },
    employee: { id: "employee-1", name: "Asha Patel" },
    financialYearStart: 2026,
    month: "2026-05",
    hasSavedPayroll: true,
    lineItems: [lineItem],
    monthlyPayroll: [
      { month: "2026-04", lineItems: [{ ...lineItem, amountPaise: 90_000 }] },
      { month: "2026-05", lineItems: [lineItem] },
    ],
    ...input,
  };
}

function createLoadedState(form = createForm()) {
  const initial = createPayrollWorkspaceState({ financialYearStart: 2026, month: form.month });
  const selected = transitionPayrollWorkspace(initial, {
    type: "selectEmployee",
    employeeId: form.employee.id,
    discardConfirmed: true,
  }).state;
  return transitionPayrollWorkspace(selected, { type: "formLoaded", form }).state;
}

describe("Payroll workspace lifecycle", () => {
  it("ignores a stale form response whose selection identity no longer matches", () => {
    const state = transitionPayrollWorkspace(
      createPayrollWorkspaceState({ financialYearStart: 2026, month: "2026-05" }),
      { type: "selectEmployee", employeeId: "employee-2", discardConfirmed: true },
    ).state;

    const result = transitionPayrollWorkspace(state, {
      type: "formLoaded",
      form: createForm(),
    });

    expect(result.outcome).toBe("staleResponseIgnored");
    expect(result.state).toBe(state);
  });

  it("requires confirmation before discarding dirty state for a new selection", () => {
    const dirty = transitionPayrollWorkspace(createLoadedState(), {
      type: "amountChanged",
      lineItemKey: "earnings:fixed:basicPay",
      amount: "invalid",
    }).state;

    const blocked = transitionPayrollWorkspace(dirty, {
      type: "selectEmployee",
      employeeId: "employee-2",
      discardConfirmed: false,
    });
    const confirmed = transitionPayrollWorkspace(dirty, {
      type: "selectEmployee",
      employeeId: "employee-2",
      discardConfirmed: true,
    });

    expect(blocked.outcome).toBe("requiresDiscardConfirmation");
    expect(blocked.state).toBe(dirty);
    expect(confirmed.outcome).toBe("applied");
    expect(confirmed.state).toMatchObject({ employeeId: "employee-2", isDirty: false });
    expect(confirmed.state.loadedForm).toBeNull();
  });

  it("formats edits and returns to a clean saved value", () => {
    const dirty = transitionPayrollWorkspace(createLoadedState(), {
      type: "amountChanged",
      lineItemKey: "earnings:fixed:basicPay",
      amount: "1000",
    }).state;
    const formatted = transitionPayrollWorkspace(dirty, {
      type: "amountFormatted",
      lineItemKey: "earnings:fixed:basicPay",
    }).state;

    expect(formatted.lineItems[0]?.amount).toBe("1,000.00");
    expect(formatted.isDirty).toBe(false);
  });

  it("marks Custom Field add and archive results for refresh", () => {
    const added = transitionPayrollWorkspace(createLoadedState(), {
      type: "customFieldAdded",
      field: { id: "allowance", section: "earnings", label: "Allowance", sortOrder: 2 },
    });
    const archived = transitionPayrollWorkspace(added.state, {
      type: "customFieldArchived",
    });

    expect(added.outcome).toBe("refreshRequired");
    expect(added.state.lineItems.at(-1)).toMatchObject({
      customFieldDefinitionId: "allowance",
      amount: "",
    });
    expect(archived.outcome).toBe("refreshRequired");
  });

  it("serializes the current non-archived values for the existing save procedure", () => {
    const state = transitionPayrollWorkspace(createLoadedState(), {
      type: "amountChanged",
      lineItemKey: "earnings:fixed:basicPay",
      amount: "1,234.50",
    }).state;

    expect(serializePayrollWorkspaceSave(state)).toEqual({
      employeeId: "employee-1",
      financialYearStart: 2026,
      month: "2026-05",
      lineItems: [
        {
          section: "earnings",
          fixedFieldKey: "basicPay",
          customFieldDefinitionId: null,
          amount: "1234.50",
        },
      ],
    });
  });

  it("reloads clean state from a matching save result", () => {
    const dirty = transitionPayrollWorkspace(createLoadedState(), {
      type: "amountChanged",
      lineItemKey: "earnings:fixed:basicPay",
      amount: "1200",
    }).state;
    const savedForm = createForm({ lineItems: [{ ...lineItem, amountPaise: 120_000 }] });

    const result = transitionPayrollWorkspace(dirty, { type: "saveSucceeded", form: savedForm });

    expect(result.outcome).toBe("applied");
    expect(result.state.isDirty).toBe(false);
    expect(result.state.lineItems[0]?.amount).toBe("1,200.00");
  });

  it("preserves the empty-input display for a loaded zero amount", () => {
    const state = createLoadedState(
      createForm({ lineItems: [{ ...lineItem, amountPaise: 0 }] }),
    );

    expect(state.lineItems[0]?.amount).toBe("");
  });
});

describe("Payroll workspace view", () => {
  it("derives Employee labels, previous-month values, totals, and capabilities", () => {
    const state = createLoadedState();
    const view = getPayrollWorkspaceView(state, [
      { id: "employee-1", firstName: "Asha", middleName: "R", surname: "Patel" },
    ]);

    expect(view.employees).toEqual([
      expect.objectContaining({ id: "employee-1", label: "Asha R Patel" }),
    ]);
    expect(view.previousMonth?.shortLabel).toBe("Apr 2026");
    expect(view.previousMonthAmounts.get("earnings:fixed:basicPay")).toBe(90_000);
    expect(view.totals).toEqual({
      earningsPaise: 100_000,
      deductionsPaise: 0,
      netPayPaise: 100_000,
    });
    expect(view.capabilities).toMatchObject({
      hasInvalidAmounts: false,
      canSave: true,
      canDownload: true,
    });
    expect(view.lineItems[0]?.isInvalidAmount).toBe(false);
  });

  it("projects per-line amount validation for render-only consumers", () => {
    const invalid = transitionPayrollWorkspace(createLoadedState(), {
      type: "amountChanged",
      lineItemKey: "earnings:fixed:basicPay",
      amount: "invalid",
    }).state;

    expect(getPayrollWorkspaceView(invalid, []).lineItems[0]?.isInvalidAmount).toBe(true);
  });

  it("blocks documents for dirty or unsaved Payroll", () => {
    const dirty = transitionPayrollWorkspace(createLoadedState(), {
      type: "amountChanged",
      lineItemKey: "earnings:fixed:basicPay",
      amount: "1200",
    }).state;
    const unsaved = createLoadedState(createForm({ hasSavedPayroll: false }));

    expect(buildPayrollWorkspaceDocument(dirty, "monthly")).toEqual({
      status: "blocked",
      reason: "workspaceNotDownloadable",
    });
    expect(buildPayrollWorkspaceDocument(unsaved, "annual")).toEqual({
      status: "blocked",
      reason: "payrollNotSaved",
    });
  });

  it("projects monthly and annual documents with stable filenames", () => {
    const state = createLoadedState();
    const monthly = buildPayrollWorkspaceDocument(state, "monthly");
    const annual = buildPayrollWorkspaceDocument(state, "annual");

    expect(monthly).toMatchObject({
      status: "ready",
      fileName: "payslip-asha-patel-may-2026.pdf",
      tableModel: { rows: [{ rowLabel: "May 2026" }, { rowLabel: "Total" }] },
    });
    expect(annual).toMatchObject({
      status: "ready",
      fileName: "annual-payslip-asha-patel-2026-2027.pdf",
    });
    if (annual.status === "ready") expect(annual.tableModel.rows).toHaveLength(13);
  });
});

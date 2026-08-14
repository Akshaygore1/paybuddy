import { afterEach, describe, expect, it, vi } from "vitest";

import { setSelectedFinancialYearStart } from "../lib/financial-year";
import {
  createPayrollWorkspaceState,
  transitionPayrollWorkspace,
  type PayrollWorkspaceForm,
} from "../lib/payroll-workspace";

vi.mock("../utils/trpc", () => ({ queryClient: {}, trpc: {} }));

import {
  completePayrollWorkspaceMutation,
  executePayrollWorkspaceDownload,
  payrollFinancialYearExternalStore,
  reportPayrollWorkspaceMutationError,
  resolvePayrollWorkspaceSelection,
} from "./use-payroll-workspace";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Payroll workspace adapter selection", () => {
  const dirtyState = {
    ...createPayrollWorkspaceState({ financialYearStart: 2026, month: "2026-04" }),
    isDirty: true,
  };
  const command = {
    type: "selectEmployee" as const,
    employeeId: "employee-2",
    discardConfirmed: false,
  };

  it("keeps prior state when discard confirmation is canceled", () => {
    const confirmDiscard = vi.fn(() => false);

    const result = resolvePayrollWorkspaceSelection(dirtyState, command, confirmDiscard);

    expect(confirmDiscard).toHaveBeenCalledOnce();
    expect(result.outcome).toBe("requiresDiscardConfirmation");
    expect(result.state).toBe(dirtyState);
  });

  it("applies the selection after discard confirmation", () => {
    const result = resolvePayrollWorkspaceSelection(dirtyState, command, () => true);

    expect(result.outcome).toBe("applied");
    expect(result.state).toMatchObject({ employeeId: "employee-2", isDirty: false });
  });
});

describe("Payroll workspace adapter effects", () => {
  it("notifies and invalidates after a successful mutation", async () => {
    const notifySuccess = vi.fn();
    const invalidateForm = vi.fn(async () => undefined);

    await completePayrollWorkspaceMutation("Payroll saved", {
      notifySuccess,
      invalidateForm,
    });

    expect(notifySuccess).toHaveBeenCalledWith("Payroll saved");
    expect(invalidateForm).toHaveBeenCalledOnce();
  });

  it("reports a mutation error without changing workspace state", () => {
    const notifyError = vi.fn();

    reportPayrollWorkspaceMutationError(new Error("Save failed"), { notifyError });

    expect(notifyError).toHaveBeenCalledWith("Save failed");
  });

  it("wires the hook's external store to Payroll Financial Year subscriptions", () => {
    let storedValue = "2026";
    vi.stubGlobal("window", {
      localStorage: {
        getItem: vi.fn(() => storedValue),
        setItem: vi.fn((_key: string, value: string) => {
          storedValue = value;
        }),
      },
    });
    const listener = vi.fn();
    const unsubscribe = payrollFinancialYearExternalStore.subscribe(listener);

    expect(payrollFinancialYearExternalStore.getSnapshot()).toBe(2026);
    expect(setSelectedFinancialYearStart(2025)).toBe(true);
    expect(listener).toHaveBeenCalledOnce();
    expect(payrollFinancialYearExternalStore.getSnapshot()).toBe(2025);
    unsubscribe();
  });

  it("projects and downloads a saved Payroll document through the injected adapter", async () => {
    const form: PayrollWorkspaceForm = {
      institution: { name: "School", address: "Road", tanNumber: "TAN123" },
      employee: { id: "employee-1", name: "Asha Patel" },
      financialYearStart: 2026,
      month: "2026-04",
      hasSavedPayroll: true,
      lineItems: [],
      monthlyPayroll: [],
    };
    const selected = transitionPayrollWorkspace(
      createPayrollWorkspaceState({ financialYearStart: 2026, month: "2026-04" }),
      {
        type: "selectEmployee",
        employeeId: "employee-1",
        discardConfirmed: true,
      },
    ).state;
    const loaded = transitionPayrollWorkspace(selected, { type: "formLoaded", form }).state;
    const downloadDocument = vi.fn(async () => undefined);
    const notifyError = vi.fn();

    await expect(
      executePayrollWorkspaceDownload(loaded, "monthly", {
        downloadDocument,
        notifyError,
      }),
    ).resolves.toBe("downloaded");
    expect(downloadDocument).toHaveBeenCalledWith(
      expect.objectContaining({ fileName: "payslip-asha-patel-apr-2026.pdf" }),
    );
    expect(notifyError).not.toHaveBeenCalled();
  });
});

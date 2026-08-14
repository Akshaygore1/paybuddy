import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getDefaultPayrollMonth,
  isPayrollFinancialYearStart,
} from "@tds-nivaran/api/payroll-financial-year";

import {
  getSelectedFinancialYearStart,
  registerSelectedFinancialYearChangeGuard,
  setSelectedFinancialYearStart,
  subscribeSelectedFinancialYear,
} from "../lib/financial-year";
import { downloadPayrollDocument } from "../lib/payroll-document";
import {
  buildPayrollWorkspaceDocument,
  createPayrollWorkspaceState,
  getPayrollWorkspaceCalendarView,
  getPayrollWorkspaceEditorView,
  getPayrollWorkspaceEmployeeView,
  getPayrollWorkspacePreviousMonthView,
  serializePayrollWorkspaceSave,
  transitionPayrollWorkspace,
  type PayrollWorkspaceCommand,
  type PayrollSection,
  type PayrollWorkspaceForm,
  type PayrollWorkspaceSelectionCommand,
  type PayrollWorkspaceState,
} from "../lib/payroll-workspace";
import { queryClient, trpc } from "../utils/trpc";

export const payrollFinancialYearExternalStore = {
  subscribe: subscribeSelectedFinancialYear,
  getSnapshot: getSelectedFinancialYearStart,
};

type PayrollWorkspaceEffectDependencies = {
  notifySuccess: (message: string) => void;
  notifyError: (message: string) => void;
  invalidateForm: () => Promise<void>;
  downloadDocument: typeof downloadPayrollDocument;
};

export async function completePayrollWorkspaceMutation(
  message: string,
  dependencies: Pick<PayrollWorkspaceEffectDependencies, "notifySuccess" | "invalidateForm">,
) {
  dependencies.notifySuccess(message);
  await dependencies.invalidateForm();
}

export function reportPayrollWorkspaceMutationError(
  error: { message: string },
  dependencies: Pick<PayrollWorkspaceEffectDependencies, "notifyError">,
) {
  dependencies.notifyError(error.message);
}

export async function executePayrollWorkspaceDownload(
  state: PayrollWorkspaceState,
  kind: "monthly" | "annual",
  dependencies: Pick<PayrollWorkspaceEffectDependencies, "notifyError" | "downloadDocument">,
) {
  const result = buildPayrollWorkspaceDocument(state, kind);

  if (result.status === "blocked") {
    dependencies.notifyError(
      result.reason === "payrollNotSaved"
        ? "Save payroll before downloading a payslip"
        : "Save payroll changes before downloading a payslip",
    );
    return "blocked" as const;
  }

  await dependencies.downloadDocument({
    tableModel: result.tableModel,
    fileName: result.fileName,
  });
  return "downloaded" as const;
}

export function resolvePayrollWorkspaceSelection(
  state: PayrollWorkspaceState,
  command: PayrollWorkspaceSelectionCommand,
  confirmDiscard: () => boolean,
) {
  const initial = transitionPayrollWorkspace(state, command);

  if (initial.outcome !== "requiresDiscardConfirmation") {
    return initial;
  }

  if (!confirmDiscard()) {
    return initial;
  }

  return transitionPayrollWorkspace(state, { ...command, discardConfirmed: true });
}

function toWorkspaceForm(
  form: Omit<PayrollWorkspaceForm, "financialYearStart"> & { financialYearStart: number },
): PayrollWorkspaceForm {
  if (!isPayrollFinancialYearStart(form.financialYearStart)) {
    throw new Error(`Unsupported Payroll Financial Year: ${form.financialYearStart}`);
  }

  return { ...form, financialYearStart: form.financialYearStart };
}

function applyRefreshRequiredResult(
  current: PayrollWorkspaceState,
  command: Extract<PayrollWorkspaceCommand, { type: "customFieldAdded" | "customFieldArchived" }>,
) {
  const clean = current.isDirty
    ? transitionPayrollWorkspace(current, { type: "discarded" }).state
    : current;
  return transitionPayrollWorkspace(clean, command).state;
}

export function usePayrollWorkspace() {
  const selectedFinancialYearStart = React.useSyncExternalStore(
    payrollFinancialYearExternalStore.subscribe,
    payrollFinancialYearExternalStore.getSnapshot,
    payrollFinancialYearExternalStore.getSnapshot,
  );
  const [state, setState] = React.useState(() =>
    createPayrollWorkspaceState({
      financialYearStart: selectedFinancialYearStart,
      month: getDefaultPayrollMonth(selectedFinancialYearStart),
    }),
  );
  const [isDownloading, setIsDownloading] = React.useState(false);
  const employeesQuery = useQuery(trpc.payroll.getEmployees.queryOptions());
  const formQuery = useQuery({
    ...trpc.payroll.getForm.queryOptions({
      employeeId: state.employeeId || "__pending__",
      financialYearStart: state.financialYearStart,
      month: state.month,
    }),
    enabled: Boolean(state.employeeId),
  });
  const saveMutation = useMutation(
    trpc.payroll.save.mutationOptions({
      onSuccess: async (data) => {
        setState((current) =>
          transitionPayrollWorkspace(current, {
            type: "saveSucceeded",
            form: toWorkspaceForm(data),
          }).state,
        );
        await completePayrollWorkspaceMutation("Payroll saved", {
          notifySuccess: toast.success,
          invalidateForm: () =>
            queryClient.invalidateQueries({ queryKey: trpc.payroll.getForm.queryKey() }),
        });
      },
      onError: (error) => reportPayrollWorkspaceMutationError(error, { notifyError: toast.error }),
    }),
  );
  const addCustomFieldMutation = useMutation(
    trpc.payroll.addCustomField.mutationOptions({
      onSuccess: async (field) => {
        setState((current) => {
          return applyRefreshRequiredResult(current, { type: "customFieldAdded", field });
        });
        await completePayrollWorkspaceMutation("Payroll field added", {
          notifySuccess: toast.success,
          invalidateForm: () =>
            queryClient.invalidateQueries({ queryKey: trpc.payroll.getForm.queryKey() }),
        });
      },
      onError: (error) => reportPayrollWorkspaceMutationError(error, { notifyError: toast.error }),
    }),
  );
  const archiveCustomFieldMutation = useMutation(
    trpc.payroll.archiveCustomField.mutationOptions({
      onSuccess: async () => {
        setState((current) => {
          return applyRefreshRequiredResult(current, { type: "customFieldArchived" });
        });
        await completePayrollWorkspaceMutation("Payroll field archived", {
          notifySuccess: toast.success,
          invalidateForm: () =>
            queryClient.invalidateQueries({ queryKey: trpc.payroll.getForm.queryKey() }),
        });
      },
      onError: (error) => reportPayrollWorkspaceMutationError(error, { notifyError: toast.error }),
    }),
  );

  React.useEffect(() => {
    if (!formQuery.data) return;
    setState((current) =>
      transitionPayrollWorkspace(current, {
        type: "formLoaded",
        form: toWorkspaceForm(formQuery.data),
      }).state,
    );
  }, [formQuery.data]);

  React.useEffect(() => {
    return registerSelectedFinancialYearChangeGuard(() => {
      return !state.isDirty || window.confirm("Discard your unsaved payroll changes?");
    });
  }, [state.isDirty]);

  React.useEffect(() => {
    setState((current) => {
      if (selectedFinancialYearStart === current.financialYearStart) return current;
      return transitionPayrollWorkspace(current, {
        type: "selectFinancialYear",
        financialYearStart: selectedFinancialYearStart,
        month: getDefaultPayrollMonth(selectedFinancialYearStart),
        discardConfirmed: true,
      }).state;
    });
  }, [selectedFinancialYearStart]);

  const calendarView = React.useMemo(
    () => getPayrollWorkspaceCalendarView(state),
    [state.employeeId, state.financialYearStart, state.month],
  );
  const employeeView = React.useMemo(
    () => getPayrollWorkspaceEmployeeView(employeesQuery.data ?? []),
    [employeesQuery.data],
  );
  const previousMonthView = React.useMemo(
    () =>
      getPayrollWorkspacePreviousMonthView(state, calendarView.selection.previousMonth),
    [calendarView.selection.previousMonth, state.loadedForm],
  );
  const editorView = React.useMemo(
    () => getPayrollWorkspaceEditorView(state),
    [state.isDirty, state.lineItems, state.loadedForm],
  );
  const view = React.useMemo(
    () => ({
      ...calendarView,
      ...employeeView,
      ...previousMonthView,
      ...editorView,
      previousMonth: calendarView.selection.previousMonth,
    }),
    [calendarView, editorView, employeeView, previousMonthView],
  );

  function confirmDiscard() {
    return window.confirm("Discard your unsaved payroll changes?");
  }

  function applySelection(command: PayrollWorkspaceSelectionCommand) {
    const result = resolvePayrollWorkspaceSelection(state, command, confirmDiscard);
    if (result.outcome !== "requiresDiscardConfirmation") setState(result.state);
    return result.outcome;
  }

  async function save() {
    const input = serializePayrollWorkspaceSave(state);
    if (!input || !view.capabilities.canSave) {
      if (view.capabilities.hasInvalidAmounts) {
        toast.error("Fix invalid payroll amounts before saving");
      }
      return;
    }
    await saveMutation.mutateAsync(input);
  }

  async function addCustomField(section: PayrollSection, label: string) {
    if (state.isDirty && !confirmDiscard()) return null;
    const field = await addCustomFieldMutation.mutateAsync({
      financialYearStart: state.financialYearStart,
      month: state.month,
      section,
      label,
    });
    return `${field.section}:custom:${field.id}`;
  }

  async function archiveCustomField(id: string) {
    if (state.isDirty && !confirmDiscard()) return;
    await archiveCustomFieldMutation.mutateAsync({
      id,
      financialYearStart: state.financialYearStart,
      month: state.month,
    });
  }

  async function download(kind: "monthly" | "annual") {
    setIsDownloading(true);
    try {
      await executePayrollWorkspaceDownload(state, kind, {
        notifyError: toast.error,
        downloadDocument: downloadPayrollDocument,
      });
    } finally {
      setIsDownloading(false);
    }
  }

  return {
    view,
    status: {
      employees: {
        isPending: employeesQuery.isPending,
        isFetching: employeesQuery.isFetching,
        error: employeesQuery.error,
      },
      form: {
        isPending: formQuery.isPending,
        isFetching: formQuery.isFetching,
        error: formQuery.error,
      },
      save: { isPending: saveMutation.isPending },
      addField: { isPending: addCustomFieldMutation.isPending },
      archiveField: { isPending: archiveCustomFieldMutation.isPending },
      download: { isPending: isDownloading },
    },
    actions: {
      selectEmployee(employeeId: string) {
        applySelection({ type: "selectEmployee", employeeId, discardConfirmed: false });
      },
      selectMonth(month: string) {
        applySelection({ type: "selectMonth", month, discardConfirmed: false });
      },
      selectFinancialYear(value: string | null) {
        const next = Number(value);
        if (isPayrollFinancialYearStart(next) && next !== state.financialYearStart) {
          setSelectedFinancialYearStart(next);
        }
      },
      updateAmount(lineItemKey: string, amount: string) {
        setState((current) =>
          transitionPayrollWorkspace(current, {
            type: "amountChanged",
            lineItemKey,
            amount,
          }).state,
        );
      },
      formatAmount(lineItemKey: string) {
        setState((current) =>
          transitionPayrollWorkspace(current, { type: "amountFormatted", lineItemKey }).state,
        );
      },
      save,
      addCustomField,
      archiveCustomField,
      downloadMonthly: () => download("monthly"),
      downloadAnnual: () => download("annual"),
    },
  };
}

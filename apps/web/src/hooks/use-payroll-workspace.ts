import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  financialYearBeforeChangeEvent,
  financialYearChangeEvent,
  financialYearOptions,
  readSelectedFinancialYearStart,
  type FinancialYearStart,
  writeSelectedFinancialYearStart,
} from "@/lib/financial-year";
import { formatPaiseForInput, normalizePayrollInputForApi } from "@/lib/payroll-money";
import {
  createPayrollWorkspaceState,
  getPayrollLineItemKey,
  payrollWorkspaceReducer,
  type PayrollLineItemState,
  type PayrollSection,
  validatePayrollWorkspace,
} from "@/lib/payroll-workspace";
import { queryClient, trpc } from "@/utils/trpc";

function getFinancialYearMonth(financialYearStart: number) {
  const now = new Date();
  const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const april = `${financialYearStart}-04`;
  const march = `${financialYearStart + 1}-03`;
  return current >= april && current <= march ? current : april;
}

function toLineItems(form: {
  lineItems: Array<Omit<PayrollLineItemState, "amount"> & { amountPaise: number }>;
}) {
  return form.lineItems.map((item) => ({ ...item, amount: formatPaiseForInput(item.amountPaise) }));
}

export function usePayrollWorkspace() {
  const initialFinancialYear = React.useMemo(() => readSelectedFinancialYearStart(), []);
  const [state, dispatch] = React.useReducer(
    payrollWorkspaceReducer,
    createPayrollWorkspaceState({
      financialYearStart: initialFinancialYear,
      month: getFinancialYearMonth(initialFinancialYear),
    }),
  );
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
        dispatch({
          type: "formLoaded",
          identity: {
            employeeId: data.employee.id,
            financialYearStart: data.financialYearStart as FinancialYearStart,
            month: data.month,
          },
          lineItems: toLineItems(data),
        });
        toast.success("Payroll saved");
        await queryClient.invalidateQueries({ queryKey: trpc.payroll.getForm.queryKey() });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
  const addCustomFieldMutation = useMutation(
    trpc.payroll.addCustomField.mutationOptions({
      onSuccess: async () => {
        toast.success("Payroll field added");
        await queryClient.invalidateQueries({ queryKey: trpc.payroll.getForm.queryKey() });
      },
      onError: (error) => toast.error(error.message),
    }),
  );
  const archiveCustomFieldMutation = useMutation(
    trpc.payroll.archiveCustomField.mutationOptions({
      onSuccess: async () => {
        toast.success("Payroll field archived");
        await queryClient.invalidateQueries({ queryKey: trpc.payroll.getForm.queryKey() });
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  React.useEffect(() => {
    if (!formQuery.data || state.isDirty) return;
    if (
      formQuery.data.employee.id !== state.employeeId ||
      formQuery.data.financialYearStart !== state.financialYearStart ||
      formQuery.data.month !== state.month
    ) {
      return;
    }
    dispatch({
      type: "formLoaded",
      identity: {
        employeeId: formQuery.data.employee.id,
        financialYearStart: formQuery.data.financialYearStart as FinancialYearStart,
        month: formQuery.data.month,
      },
      lineItems: toLineItems(formQuery.data),
    });
  }, [formQuery.data, state.employeeId, state.financialYearStart, state.isDirty, state.month]);

  React.useEffect(() => {
    function confirmFinancialYearChange(event: Event) {
      if (state.isDirty && !window.confirm("Discard your unsaved payroll changes?"))
        event.preventDefault();
    }
    function syncFinancialYear(event: Event) {
      const detail = (event as CustomEvent<{ financialYearStart: FinancialYearStart }>).detail;
      const financialYearStart = detail?.financialYearStart ?? readSelectedFinancialYearStart();
      if (financialYearStart !== state.financialYearStart) {
        dispatch({
          type: "financialYearSelected",
          financialYearStart,
          month: getFinancialYearMonth(financialYearStart),
        });
      }
    }
    window.addEventListener(financialYearBeforeChangeEvent, confirmFinancialYearChange);
    window.addEventListener(financialYearChangeEvent, syncFinancialYear);
    return () => {
      window.removeEventListener(financialYearBeforeChangeEvent, confirmFinancialYearChange);
      window.removeEventListener(financialYearChangeEvent, syncFinancialYear);
    };
  }, [state.financialYearStart, state.isDirty]);

  function confirmDiscard() {
    if (state.isDirty && !window.confirm("Discard your unsaved payroll changes?")) return false;
    if (state.isDirty) dispatch({ type: "discarded" });
    return true;
  }

  async function save() {
    const validation = validatePayrollWorkspace(state);
    if (!validation.canSave || !state.loadedForm) {
      if (validation.hasInvalidAmounts) toast.error("Fix invalid payroll amounts before saving");
      return;
    }
    await saveMutation.mutateAsync({
      ...state.loadedForm,
      lineItems: state.lineItems
        .filter((item) => !item.isArchivedCustomField)
        .map((item) => ({
          section: item.section,
          fixedFieldKey: item.fixedFieldKey,
          customFieldDefinitionId: item.customFieldDefinitionId,
          amount: normalizePayrollInputForApi(item.amount) || "0",
        })),
    });
  }

  async function addCustomField(section: PayrollSection, label: string) {
    if (!confirmDiscard()) return null;
    const field = await addCustomFieldMutation.mutateAsync({
      financialYearStart: state.financialYearStart,
      month: state.month,
      section,
      label,
    });
    const lineItem: PayrollLineItemState = {
      section: field.section,
      fixedFieldKey: null,
      customFieldDefinitionId: field.id,
      label: field.label,
      amount: "",
      sortOrder: 1000 + field.sortOrder,
      isArchivedCustomField: false,
    };
    dispatch({ type: "customFieldAdded", lineItem });
    return getPayrollLineItemKey(lineItem);
  }

  async function archiveCustomField(id: string) {
    if (!confirmDiscard()) return;
    await archiveCustomFieldMutation.mutateAsync({
      id,
      financialYearStart: state.financialYearStart,
      month: state.month,
    });
  }

  return {
    state,
    validation: validatePayrollWorkspace(state),
    employeesQuery,
    formQuery,
    saveMutation,
    addCustomFieldMutation,
    archiveCustomFieldMutation,
    selectEmployee(employeeId: string) {
      if (employeeId !== state.employeeId && confirmDiscard())
        dispatch({ type: "employeeSelected", employeeId });
    },
    selectMonth(month: string) {
      if (month !== state.month && confirmDiscard()) dispatch({ type: "monthSelected", month });
    },
    selectFinancialYear(value: string | null) {
      const next = Number(value) as FinancialYearStart;
      if (financialYearOptions.includes(next) && next !== state.financialYearStart) {
        writeSelectedFinancialYearStart(next);
      }
    },
    updateAmount(lineItemKey: string, amount: string) {
      dispatch({ type: "amountChanged", lineItemKey, amount });
    },
    formatAmount(lineItemKey: string) {
      dispatch({ type: "amountFormatted", lineItemKey });
    },
    save,
    addCustomField,
    archiveCustomField,
  };
}

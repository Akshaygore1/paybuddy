import {
  getPayrollFinancialYearLabel,
  getPayrollFinancialYearMonths,
  payrollFinancialYearStartValues,
  type PayrollFinancialYearStart,
} from "@tds-nivaran/api/payroll-financial-year";

import {
  formatPaiseForInput,
  formatPayrollInput,
  normalizePayrollInputForApi,
  parsePayrollInputToPaise,
} from "./payroll-money";
import { buildPayrollPdfTableModel, type PayrollPdfLineItem } from "./payroll-pdf";

export type PayrollSection = "earnings" | "deductions";

export type PayrollLineItemState = {
  section: PayrollSection;
  fixedFieldKey: string | null;
  customFieldDefinitionId: string | null;
  label: string;
  amount: string;
  sortOrder: number;
  isArchivedCustomField?: boolean;
};

export type PayrollLineItemView = PayrollLineItemState & {
  isInvalidAmount: boolean;
};

type PayrollWorkspaceFormLineItem = Omit<PayrollLineItemState, "amount"> & {
  amountPaise: number;
};

export type PayrollWorkspaceForm = {
  institution: { name: string; address: string; tanNumber: string };
  employee: { id: string; name: string };
  financialYearStart: PayrollFinancialYearStart;
  month: string;
  hasSavedPayroll: boolean;
  lineItems: PayrollWorkspaceFormLineItem[];
  monthlyPayroll: Array<{
    month: string;
    lineItems: PayrollPdfLineItem[];
  }>;
};

export type PayrollWorkspaceState = {
  financialYearStart: PayrollFinancialYearStart;
  employeeId: string;
  month: string;
  loadedForm: PayrollWorkspaceForm | null;
  lineItems: PayrollLineItemState[];
  savedLineItems: PayrollLineItemState[];
  isDirty: boolean;
};

export type PayrollWorkspaceCommand =
  | { type: "selectEmployee"; employeeId: string; discardConfirmed: boolean }
  | { type: "selectMonth"; month: string; discardConfirmed: boolean }
  | {
      type: "selectFinancialYear";
      financialYearStart: PayrollFinancialYearStart;
      month: string;
      discardConfirmed: boolean;
    }
  | { type: "formLoaded"; form: PayrollWorkspaceForm }
  | { type: "saveSucceeded"; form: PayrollWorkspaceForm }
  | { type: "amountChanged"; lineItemKey: string; amount: string }
  | { type: "amountFormatted"; lineItemKey: string }
  | {
      type: "customFieldAdded";
      field: { id: string; section: PayrollSection; label: string; sortOrder: number };
    }
  | { type: "customFieldArchived" }
  | { type: "discarded" }
  | { type: "cleared" };

export type PayrollWorkspaceSelectionCommand = Extract<
  PayrollWorkspaceCommand,
  { type: "selectEmployee" | "selectMonth" | "selectFinancialYear" }
>;

export type PayrollWorkspaceTransitionOutcome =
  | "applied"
  | "noChange"
  | "requiresDiscardConfirmation"
  | "staleResponseIgnored"
  | "refreshRequired";

export type PayrollWorkspaceTransition = {
  state: PayrollWorkspaceState;
  outcome: PayrollWorkspaceTransitionOutcome;
};

export function getPayrollLineItemKey(
  item: Pick<PayrollLineItemState, "section" | "fixedFieldKey" | "customFieldDefinitionId">,
) {
  return item.fixedFieldKey
    ? `${item.section}:fixed:${item.fixedFieldKey}`
    : `${item.section}:custom:${item.customFieldDefinitionId}`;
}

export function createPayrollWorkspaceState(input: {
  financialYearStart: PayrollFinancialYearStart;
  month: string;
}): PayrollWorkspaceState {
  return {
    financialYearStart: input.financialYearStart,
    employeeId: "",
    month: input.month,
    loadedForm: null,
    lineItems: [],
    savedLineItems: [],
    isDirty: false,
  };
}

function toLineItems(form: PayrollWorkspaceForm) {
  return form.lineItems.map((item) => ({
    ...item,
    amount: formatPaiseForInput(item.amountPaise),
  }));
}

function hasPayrollEdits(
  lineItems: PayrollLineItemState[],
  savedLineItems: PayrollLineItemState[],
) {
  const savedAmounts = new Map(
    savedLineItems.map((item) => [getPayrollLineItemKey(item), item.amount]),
  );
  return (
    lineItems.length !== savedLineItems.length ||
    lineItems.some((item) => savedAmounts.get(getPayrollLineItemKey(item)) !== item.amount)
  );
}

function clearLoadedState(state: PayrollWorkspaceState): PayrollWorkspaceState {
  return {
    ...state,
    loadedForm: null,
    lineItems: [],
    savedLineItems: [],
    isDirty: false,
  };
}

function applySelection(
  state: PayrollWorkspaceState,
  changed: boolean,
  discardConfirmed: boolean,
  select: () => PayrollWorkspaceState,
): PayrollWorkspaceTransition {
  if (!changed) return { state, outcome: "noChange" };
  if (state.isDirty && !discardConfirmed) {
    return { state, outcome: "requiresDiscardConfirmation" };
  }
  return { state: clearLoadedState(select()), outcome: "applied" };
}

function applyLoadedForm(
  state: PayrollWorkspaceState,
  form: PayrollWorkspaceForm,
  replaceDirtyState: boolean,
): PayrollWorkspaceTransition {
  if (
    form.employee.id !== state.employeeId ||
    form.financialYearStart !== state.financialYearStart ||
    form.month !== state.month
  ) {
    return { state, outcome: "staleResponseIgnored" };
  }

  if (state.isDirty && !replaceDirtyState) {
    return { state, outcome: "noChange" };
  }

  const lineItems = toLineItems(form);
  return {
    state: {
      ...state,
      loadedForm: form,
      lineItems,
      savedLineItems: lineItems,
      isDirty: false,
    },
    outcome: "applied",
  };
}

export function transitionPayrollWorkspace(
  state: PayrollWorkspaceState,
  command: PayrollWorkspaceCommand,
): PayrollWorkspaceTransition {
  switch (command.type) {
    case "selectEmployee":
      return applySelection(
        state,
        command.employeeId !== state.employeeId,
        command.discardConfirmed,
        () => ({ ...state, employeeId: command.employeeId }),
      );
    case "selectMonth":
      return applySelection(
        state,
        command.month !== state.month,
        command.discardConfirmed,
        () => ({ ...state, month: command.month }),
      );
    case "selectFinancialYear":
      return applySelection(
        state,
        command.financialYearStart !== state.financialYearStart,
        command.discardConfirmed,
        () => ({
          ...state,
          financialYearStart: command.financialYearStart,
          month: command.month,
        }),
      );
    case "formLoaded":
      return applyLoadedForm(state, command.form, false);
    case "saveSucceeded":
      return applyLoadedForm(state, command.form, true);
    case "amountChanged": {
      const lineItems = state.lineItems.map((item) =>
        getPayrollLineItemKey(item) === command.lineItemKey
          ? { ...item, amount: command.amount }
          : item,
      );
      return {
        state: {
          ...state,
          lineItems,
          isDirty: hasPayrollEdits(lineItems, state.savedLineItems),
        },
        outcome: "applied",
      };
    }
    case "amountFormatted": {
      const lineItems = state.lineItems.map((item) =>
        getPayrollLineItemKey(item) === command.lineItemKey
          ? { ...item, amount: formatPayrollInput(item.amount) }
          : item,
      );
      return {
        state: {
          ...state,
          lineItems,
          isDirty: hasPayrollEdits(lineItems, state.savedLineItems),
        },
        outcome: "applied",
      };
    }
    case "customFieldAdded": {
      if (
        state.lineItems.some(
          (item) => item.customFieldDefinitionId === command.field.id,
        )
      ) {
        return { state, outcome: "refreshRequired" };
      }

      const lineItem: PayrollLineItemState = {
        section: command.field.section,
        fixedFieldKey: null,
        customFieldDefinitionId: command.field.id,
        label: command.field.label,
        amount: "",
        sortOrder: 1000 + command.field.sortOrder,
        isArchivedCustomField: false,
      };
      return {
        state: {
          ...state,
          lineItems: [...state.lineItems, lineItem],
          savedLineItems: [...state.savedLineItems, lineItem],
        },
        outcome: "refreshRequired",
      };
    }
    case "customFieldArchived":
      return { state, outcome: "refreshRequired" };
    case "discarded":
      return {
        state: { ...state, lineItems: state.savedLineItems, isDirty: false },
        outcome: "applied",
      };
    case "cleared":
      return { state: clearLoadedState(state), outcome: "applied" };
  }
}

export function validatePayrollWorkspace(state: PayrollWorkspaceState) {
  const hasInvalidAmounts = state.lineItems.some(isPayrollLineItemAmountInvalid);
  return {
    hasInvalidAmounts,
    canSave: Boolean(state.loadedForm) && !hasInvalidAmounts,
    canDownload:
      Boolean(state.loadedForm?.hasSavedPayroll) &&
      !state.isDirty &&
      !hasInvalidAmounts,
  };
}

function isPayrollLineItemAmountInvalid(item: PayrollLineItemState) {
  return Boolean(item.amount.trim()) && Number.isNaN(parsePayrollInputToPaise(item.amount));
}

export function serializePayrollWorkspaceSave(state: PayrollWorkspaceState) {
  if (!state.loadedForm) return null;

  return {
    employeeId: state.employeeId,
    financialYearStart: state.financialYearStart,
    month: state.month,
    lineItems: state.lineItems
      .filter((item) => !item.isArchivedCustomField)
      .map((item) => ({
        section: item.section,
        fixedFieldKey: item.fixedFieldKey,
        customFieldDefinitionId: item.customFieldDefinitionId,
        amount: normalizePayrollInputForApi(item.amount) || "0",
      })),
  };
}

type PayrollWorkspaceEmployee = {
  id: string;
  firstName: string;
  middleName: string;
  surname: string;
};

export function getPayrollWorkspaceCalendarView(state: PayrollWorkspaceState) {
  const months = getPayrollFinancialYearMonths(state.financialYearStart);
  const selectedMonth = months.find((month) => month.value === state.month) ?? months[0]!;
  const selectedMonthIndex = months.findIndex((month) => month.value === selectedMonth.value);
  const previousMonth = selectedMonthIndex > 0 ? months[selectedMonthIndex - 1]! : null;

  return {
    selection: {
      financialYearStart: state.financialYearStart,
      financialYearLabel: getPayrollFinancialYearLabel(state.financialYearStart),
      employeeId: state.employeeId,
      month: state.month,
      selectedMonth,
      previousMonth,
    },
    months,
    financialYears: payrollFinancialYearStartValues.map((value) => ({
      value,
      label: getPayrollFinancialYearLabel(value),
    })),
  };
}

export function getPayrollWorkspaceEmployeeView(employees: PayrollWorkspaceEmployee[]) {
  const labeledEmployees = employees.map((employee) => ({
    ...employee,
    label: [employee.firstName, employee.middleName, employee.surname].filter(Boolean).join(" "),
  }));

  return {
    employees: labeledEmployees,
    employeeLabelById: Object.fromEntries(
      labeledEmployees.map((employee) => [employee.id, employee.label]),
    ),
  };
}

export function getPayrollWorkspacePreviousMonthView(
  state: PayrollWorkspaceState,
  previousMonth: ReturnType<typeof getPayrollFinancialYearMonths>[number] | null,
) {
  const previousPayroll = previousMonth
    ? state.loadedForm?.monthlyPayroll.find((payroll) => payroll.month === previousMonth.value)
    : null;
  return {
    previousMonthAmounts: new Map(
      (previousPayroll?.lineItems ?? []).map((item) => [
        getPayrollLineItemKey(item),
        item.amountPaise,
      ]),
    ),
  };
}

export function getPayrollWorkspaceEditorView(state: PayrollWorkspaceState) {
  let earningsPaise = 0;
  let deductionsPaise = 0;
  const lineItems: PayrollLineItemView[] = state.lineItems.map((item) => {
    const amountPaise = parsePayrollInputToPaise(item.amount);
    if (Number.isFinite(amountPaise)) {
      if (item.section === "earnings") earningsPaise += amountPaise;
      else deductionsPaise += amountPaise;
    }
    return { ...item, isInvalidAmount: isPayrollLineItemAmountInvalid(item) };
  });

  return {
    lineItems,
    totals: {
      earningsPaise,
      deductionsPaise,
      netPayPaise: earningsPaise - deductionsPaise,
    },
    capabilities: validatePayrollWorkspace(state),
  };
}

export function getPayrollWorkspaceView(
  state: PayrollWorkspaceState,
  employees: PayrollWorkspaceEmployee[],
) {
  const calendar = getPayrollWorkspaceCalendarView(state);
  const employeeView = getPayrollWorkspaceEmployeeView(employees);
  const previousMonthView = getPayrollWorkspacePreviousMonthView(
    state,
    calendar.selection.previousMonth,
  );
  const editorView = getPayrollWorkspaceEditorView(state);

  return {
    ...calendar,
    ...employeeView,
    ...previousMonthView,
    ...editorView,
    previousMonth: calendar.selection.previousMonth,
  };
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildPayrollWorkspaceDocument(
  state: PayrollWorkspaceState,
  kind: "monthly" | "annual",
) {
  const form = state.loadedForm;
  const capabilities = validatePayrollWorkspace(state);

  if (!form?.hasSavedPayroll) {
    return { status: "blocked" as const, reason: "payrollNotSaved" as const };
  }

  if (!capabilities.canDownload) {
    return { status: "blocked" as const, reason: "workspaceNotDownloadable" as const };
  }

  const months = getPayrollFinancialYearMonths(state.financialYearStart);
  const selectedMonth = months.find((month) => month.value === state.month) ?? months[0]!;
  const lineItems = state.lineItems
    .filter((item) => !item.isArchivedCustomField)
    .map((item) => {
      const amountPaise = parsePayrollInputToPaise(item.amount);
      return {
        section: item.section,
        fixedFieldKey: item.fixedFieldKey,
        customFieldDefinitionId: item.customFieldDefinitionId,
        label: item.label,
        amountPaise: Number.isFinite(amountPaise) ? amountPaise : 0,
        sortOrder: item.sortOrder,
      };
    });
  const tableModel = buildPayrollPdfTableModel({
    kind,
    financialYearLabel: getPayrollFinancialYearLabel(state.financialYearStart),
    selectedMonthValue: state.month,
    selectedMonthLabel: selectedMonth.shortLabel,
    months: months.map((month) => ({
      ...month,
      lineItems:
        form.monthlyPayroll.find((payroll) => payroll.month === month.value)?.lineItems ?? [],
    })),
    lineItems,
    institution: form.institution,
    employee: { name: form.employee.name },
  });
  const employeeSlug = slugify(form.employee.name);
  const fileName =
    kind === "monthly"
      ? `payslip-${employeeSlug}-${slugify(selectedMonth.shortLabel)}.pdf`
      : `annual-payslip-${employeeSlug}-${getPayrollFinancialYearLabel(state.financialYearStart)}.pdf`;

  return { status: "ready" as const, tableModel, fileName };
}

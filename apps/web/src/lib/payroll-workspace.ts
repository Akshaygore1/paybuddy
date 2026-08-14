import type { FinancialYearStart } from "./financial-year";
import { formatPayrollInput, parsePayrollInputToPaise } from "./payroll-money";

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

export type PayrollFormIdentity = {
  employeeId: string;
  financialYearStart: FinancialYearStart;
  month: string;
};

export type PayrollWorkspaceState = {
  financialYearStart: FinancialYearStart;
  employeeId: string;
  month: string;
  loadedForm: PayrollFormIdentity | null;
  lineItems: PayrollLineItemState[];
  savedLineItems: PayrollLineItemState[];
  isDirty: boolean;
};

export type PayrollWorkspaceEvent =
  | { type: "employeeSelected"; employeeId: string }
  | { type: "monthSelected"; month: string }
  | { type: "financialYearSelected"; financialYearStart: FinancialYearStart; month: string }
  | { type: "formLoaded"; identity: PayrollFormIdentity; lineItems: PayrollLineItemState[] }
  | { type: "amountChanged"; lineItemKey: string; amount: string }
  | { type: "amountFormatted"; lineItemKey: string }
  | { type: "customFieldAdded"; lineItem: PayrollLineItemState }
  | { type: "discarded" }
  | { type: "cleared" };

export function getPayrollLineItemKey(
  item: Pick<PayrollLineItemState, "section" | "fixedFieldKey" | "customFieldDefinitionId">,
) {
  return item.fixedFieldKey
    ? `${item.section}:fixed:${item.fixedFieldKey}`
    : `${item.section}:custom:${item.customFieldDefinitionId}`;
}

export function createPayrollWorkspaceState(input: {
  financialYearStart: FinancialYearStart;
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

export function payrollWorkspaceReducer(
  state: PayrollWorkspaceState,
  event: PayrollWorkspaceEvent,
): PayrollWorkspaceState {
  switch (event.type) {
    case "employeeSelected":
      return {
        ...state,
        employeeId: event.employeeId,
        loadedForm: null,
        lineItems: [],
        savedLineItems: [],
        isDirty: false,
      };
    case "monthSelected":
      return {
        ...state,
        month: event.month,
        loadedForm: null,
        lineItems: [],
        savedLineItems: [],
        isDirty: false,
      };
    case "financialYearSelected":
      return {
        ...state,
        financialYearStart: event.financialYearStart,
        month: event.month,
        loadedForm: null,
        lineItems: [],
        savedLineItems: [],
        isDirty: false,
      };
    case "formLoaded":
      return {
        ...state,
        loadedForm: event.identity,
        lineItems: event.lineItems,
        savedLineItems: event.lineItems,
        isDirty: false,
      };
    case "amountChanged": {
      const lineItems = state.lineItems.map((item) =>
        getPayrollLineItemKey(item) === event.lineItemKey
          ? { ...item, amount: event.amount }
          : item,
      );
      return {
        ...state,
        lineItems,
        isDirty: hasPayrollEdits(lineItems, state.savedLineItems),
      };
    }
    case "amountFormatted": {
      const lineItems = state.lineItems.map((item) =>
        getPayrollLineItemKey(item) === event.lineItemKey
          ? { ...item, amount: formatPayrollInput(item.amount) }
          : item,
      );
      return {
        ...state,
        lineItems,
        isDirty: hasPayrollEdits(lineItems, state.savedLineItems),
      };
    }
    case "customFieldAdded":
      return state.lineItems.some(
        (item) => item.customFieldDefinitionId === event.lineItem.customFieldDefinitionId,
      )
        ? state
        : {
            ...state,
            lineItems: [...state.lineItems, event.lineItem],
            savedLineItems: [...state.savedLineItems, event.lineItem],
          };
    case "discarded":
      return { ...state, lineItems: state.savedLineItems, isDirty: false };
    case "cleared":
      return { ...state, loadedForm: null, lineItems: [], savedLineItems: [], isDirty: false };
  }
}

export function validatePayrollWorkspace(state: PayrollWorkspaceState) {
  const hasInvalidAmounts = state.lineItems.some(
    (item) => item.amount.trim() && Number.isNaN(parsePayrollInputToPaise(item.amount)),
  );
  return {
    hasInvalidAmounts,
    canSave: Boolean(state.loadedForm) && !hasInvalidAmounts,
    canDownload: Boolean(state.loadedForm) && !state.isDirty && !hasInvalidAmounts,
  };
}

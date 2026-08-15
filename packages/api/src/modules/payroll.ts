import { createDb } from "@tds-nivaran/db";
import { executeD1Batch, planD1Statements } from "@tds-nivaran/db/d1";
import {
  employeePayrollProfiles,
  employeePayrollVersions,
  employees,
  payrollLineItems,
} from "@tds-nivaran/db/schema/index";
import { TRPCError } from "@trpc/server";
import type { BatchItem } from "drizzle-orm/batch";
import { and, asc, eq, inArray } from "drizzle-orm";

import type { AddPayrollCustomFieldInput, SavePayrollInput } from "../schemas/payroll";
import { buildPayrollHistoryModule, fixedPayrollFields } from "./payroll-history";
import {
  buildPayrollFieldTimelineModule,
  normalizePayrollFieldLabel,
  type PayrollFieldTimelineModule,
  type PayrollSection,
} from "./payroll-field-timeline";

export {
  calculatePayrollTotals,
  fixedPayrollFields,
  getFinancialYearMonths,
  resolvePayrollVersionForMonth,
  type PayrollLineItem,
} from "./payroll-history";
export type { PayrollSection } from "./payroll-field-timeline";

type Db = ReturnType<typeof createDb>;

type PayrollModuleOptions = {
  db?: Db;
  fieldTimeline?: PayrollFieldTimelineModule;
};

const fixedFieldLookup = new Map(
  Object.entries(fixedPayrollFields).flatMap(([section, fields]) =>
    fields.map((field, index) => [
      `${section}:${field.key}`,
      {
        ...field,
        section: section as PayrollSection,
        sortOrder: index + 1,
      },
    ]),
  ),
);

export function parseMoneyToPaise(value: string) {
  const normalized = value.trim();

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Payroll amount must be a valid non-negative amount",
    });
  }

  const [rupeesText, paiseText = ""] = normalized.split(".");
  const rupees = Number(rupeesText);

  if (!Number.isSafeInteger(rupees)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Payroll amount is too large",
    });
  }

  return rupees * 100 + Number(paiseText.padEnd(2, "0"));
}

export function formatPaiseAsMoney(amountPaise: number) {
  return `${Math.floor(amountPaise / 100)}.${String(amountPaise % 100).padStart(2, "0")}`;
}

export function getInitialPayrollEffectiveMonths(input: {
  financialYearStart: number;
  selectedMonth: string;
  activeCustomFieldPeriods: Array<{
    customFieldDefinitionId: string;
    effectiveFromMonth: string;
  }>;
}) {
  const aprilMonth = `${input.financialYearStart}-04`;
  const customFieldStarts = input.activeCustomFieldPeriods.map((period) =>
    period.effectiveFromMonth < aprilMonth ? aprilMonth : period.effectiveFromMonth,
  );

  return [...new Set([aprilMonth, ...customFieldStarts])]
    .filter((effectiveMonth) => effectiveMonth <= input.selectedMonth)
    .sort();
}

function getEmployeeName(employee: { firstName: string; middleName: string; surname: string }) {
  return [employee.firstName, employee.middleName, employee.surname]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");
}

function getFixedField(section: PayrollSection, fixedFieldKey: string | null | undefined) {
  if (!fixedFieldKey) {
    return null;
  }

  return fixedFieldLookup.get(`${section}:${fixedFieldKey}`) ?? null;
}

export function buildPayrollModule(options: PayrollModuleOptions = {}) {
  const db = options.db ?? createDb();
  const fieldTimeline = options.fieldTimeline ?? buildPayrollFieldTimelineModule({ db });
  const payrollHistory = buildPayrollHistoryModule({ db, fieldTimeline });

  async function getEmployees(institutionId: string) {
    return db
      .select({
        id: employees.id,
        firstName: employees.firstName,
        middleName: employees.middleName,
        surname: employees.surname,
        seniorityRank: employees.seniorityRank,
      })
      .from(employees)
      .where(eq(employees.institutionId, institutionId))
      .orderBy(asc(employees.seniorityRank), asc(employees.surname), asc(employees.firstName));
  }

  async function getEmployee(institutionId: string, employeeId: string) {
    const employee = await db
      .select({
        id: employees.id,
        firstName: employees.firstName,
        middleName: employees.middleName,
        surname: employees.surname,
      })
      .from(employees)
      .where(and(eq(employees.id, employeeId), eq(employees.institutionId, institutionId)))
      .get();

    if (!employee) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Employee not found",
      });
    }

    return {
      ...employee,
      name: getEmployeeName(employee),
    };
  }

  async function getProfile(employeeId: string, financialYearStart: number) {
    return db
      .select({
        id: employeePayrollProfiles.id,
        financialYearStart: employeePayrollProfiles.financialYearStart,
      })
      .from(employeePayrollProfiles)
      .where(
        and(
          eq(employeePayrollProfiles.employeeId, employeeId),
          eq(employeePayrollProfiles.financialYearStart, financialYearStart),
        ),
      )
      .get();
  }

  async function getVersions(profileId: string | undefined) {
    if (!profileId) {
      return [];
    }

    return db
      .select({
        id: employeePayrollVersions.id,
        effectiveMonth: employeePayrollVersions.effectiveMonth,
      })
      .from(employeePayrollVersions)
      .where(eq(employeePayrollVersions.payrollProfileId, profileId))
      .orderBy(asc(employeePayrollVersions.effectiveMonth));
  }

  async function getForm(
    institutionId: string,
    employeeId: string,
    financialYearStart: number,
    month: string,
  ) {
    const history = await payrollHistory.getEmployeeFinancialYear(
      institutionId,
      employeeId,
      financialYearStart,
    );
    const { institution, employee, profileId, months, monthlyPayroll } = history;
    const selectedPayroll = monthlyPayroll.find((payroll) => payroll.month === month);

    if (!selectedPayroll) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Month must belong to the financial year",
      });
    }
    const activeCustomFields = fieldTimeline.getActiveFieldsForMonth(
      { fields: history.fields, periods: history.periods },
      month,
    );

    return {
      institution,
      employee,
      financialYearStart,
      month,
      profileId,
      effectiveMonth: selectedPayroll.effectiveMonth,
      hasSavedPayroll: selectedPayroll.hasSavedPayroll,
      fixedFields: fixedPayrollFields,
      customFields: activeCustomFields,
      lineItems: selectedPayroll.lineItems,
      totals: selectedPayroll.totals,
      savedTotals: selectedPayroll.totals,
      hasSavedAmounts: selectedPayroll.lineItems.some((item) => item.amountPaise > 0),
      months,
      monthlyPayroll,
    };
  }

  async function save(institutionId: string, input: SavePayrollInput) {
    await getEmployee(institutionId, input.employeeId);

    const customFieldTimeline = await fieldTimeline.load(institutionId);
    const activeCustomFields = fieldTimeline.getActiveFieldsForMonth(
      customFieldTimeline,
      input.month,
    );
    const activeCustomFieldIds = new Set(activeCustomFields.map((field) => field.id));
    const activeCustomFieldsById = new Map(activeCustomFields.map((field) => [field.id, field]));

    const normalizedLineItems = input.lineItems.map((item) => {
      const fixedField = getFixedField(item.section, item.fixedFieldKey);
      const customFieldId = item.customFieldDefinitionId ?? null;

      if (fixedField && customFieldId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Payroll line item cannot be both fixed and custom",
        });
      }

      if (!fixedField && !customFieldId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Payroll line item is missing a field reference",
        });
      }

      if (customFieldId && !activeCustomFieldIds.has(customFieldId)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Payroll form contains invalid custom fields",
        });
      }

      const customField = customFieldId ? activeCustomFieldsById.get(customFieldId) : null;

      if (customField && customField.section !== item.section) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Payroll custom field was submitted in the wrong section",
        });
      }

      return {
        section: item.section,
        fixedFieldKey: fixedField?.key ?? null,
        customFieldDefinitionId: customField?.id ?? null,
        label: fixedField?.label ?? customField?.label ?? "",
        amountPaise: parseMoneyToPaise(item.amount),
        sortOrder: fixedField?.sortOrder ?? 1000 + (customField?.sortOrder ?? 0),
      };
    });

    const fixedKeys = new Set<string>();
    const customIds = new Set<string>();

    for (const item of normalizedLineItems) {
      if (item.fixedFieldKey) {
        const key = `${item.section}:${item.fixedFieldKey}`;

        if (fixedKeys.has(key)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Duplicate payroll field submitted",
          });
        }

        fixedKeys.add(key);
      }

      if (item.customFieldDefinitionId) {
        const key = `${item.section}:${item.customFieldDefinitionId}`;

        if (customIds.has(key)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Duplicate payroll field submitted",
          });
        }

        customIds.add(key);
      }
    }

    const profile = await getProfile(input.employeeId, input.financialYearStart);
    const payrollProfileId = profile?.id ?? crypto.randomUUID();
    const existingVersions = await getVersions(payrollProfileId);
    const queries: BatchItem<"sqlite">[] = [];

    if (!profile) {
      queries.push(
        db.insert(employeePayrollProfiles).values({
          id: payrollProfileId,
          institutionId,
          employeeId: input.employeeId,
          financialYearStart: input.financialYearStart,
        }),
      );
    }

    function queueVersionReplacement(effectiveMonth: string, items: typeof normalizedLineItems) {
      const existingVersion = existingVersions.find(
        (candidate) => candidate.effectiveMonth === effectiveMonth,
      );
      const payrollVersionId = existingVersion?.id ?? crypto.randomUUID();

      if (existingVersion) {
        queries.push(
          db
            .delete(payrollLineItems)
            .where(eq(payrollLineItems.payrollVersionId, payrollVersionId)),
        );
      } else {
        queries.push(
          db.insert(employeePayrollVersions).values({
            id: payrollVersionId,
            payrollProfileId,
            effectiveMonth,
          }),
        );
      }

      const lineItems = items.map((item) => ({
        id: crypto.randomUUID(),
        payrollVersionId,
        ...item,
      }));
      queries.push(
        ...planD1Statements(lineItems, (itemChunk) =>
          db.insert(payrollLineItems).values([...itemChunk]),
        ),
      );
    }

    // A save establishes a new baseline from the selected effective month onward.
    // Remove later explicit versions before writing the replacement so a backdated
    // correction is visible in every following month until a later month is saved
    // again deliberately.
    const laterVersions = existingVersions.filter(
      (version) => version.effectiveMonth > input.month,
    );
    if (laterVersions.length > 0) {
      const laterVersionIds = laterVersions.map((version) => version.id);
      queries.push(
        db
          .delete(payrollLineItems)
          .where(inArray(payrollLineItems.payrollVersionId, laterVersionIds)),
        db
          .delete(employeePayrollVersions)
          .where(inArray(employeePayrollVersions.id, laterVersionIds)),
      );
    }

    if (existingVersions.length === 0) {
      const activeCustomFieldPeriods = activeCustomFields.map((field) => {
        const period = fieldTimeline.getActivePeriodForMonth(
          customFieldTimeline,
          field.id,
          input.month,
        );

        if (!period) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Unable to resolve active Payroll field period",
          });
        }

        return period;
      });
      const effectiveMonths = getInitialPayrollEffectiveMonths({
        financialYearStart: input.financialYearStart,
        selectedMonth: input.month,
        activeCustomFieldPeriods,
      });
      const activePeriodByFieldId = new Map(
        activeCustomFieldPeriods.map((period) => [period.customFieldDefinitionId, period]),
      );

      for (const effectiveMonth of effectiveMonths) {
        queueVersionReplacement(
          effectiveMonth,
          normalizedLineItems.filter(
            (item) =>
              !item.customFieldDefinitionId ||
              (activePeriodByFieldId.get(item.customFieldDefinitionId)?.effectiveFromMonth ??
                input.month) <= effectiveMonth,
          ),
        );
      }
    } else {
      queueVersionReplacement(input.month, normalizedLineItems);
    }

    await executeD1Batch(db, queries);

    return getForm(institutionId, input.employeeId, input.financialYearStart, input.month);
  }

  async function addCustomField(institutionId: string, input: AddPayrollCustomFieldInput) {
    const fixedFields = fixedPayrollFields[input.section];
    const normalizedInputLabel = normalizePayrollFieldLabel(input.label);
    if (
      fixedFields.some((field) => normalizePayrollFieldLabel(field.label) === normalizedInputLabel)
    ) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "A payroll field with this label already exists in this section",
      });
    }
    return fieldTimeline.addField(institutionId, input);
  }

  async function archiveCustomField(institutionId: string, input: { id: string; month: string }) {
    return fieldTimeline.archiveField(institutionId, input);
  }

  async function getCustomFields(institutionId: string) {
    return fieldTimeline.load(institutionId);
  }

  return {
    getEmployees,
    getForm,
    save,
    addCustomField,
    archiveCustomField,
    getCustomFields,
  };
}

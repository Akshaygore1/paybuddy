import { createDb } from "@tds-nivaran/db";
import { chunkForD1, PAYROLL_LINE_ITEM_BOUND_PARAMETERS } from "@tds-nivaran/db/d1";
import {
  employeePayrollProfiles,
  employeePayrollVersions,
  employees,
  payrollCustomFieldDefinitions,
  payrollCustomFieldPeriods,
  payrollLineItems,
} from "@tds-nivaran/db/schema/index";
import { TRPCError } from "@trpc/server";
import type { BatchItem } from "drizzle-orm/batch";
import { and, asc, desc, eq } from "drizzle-orm";

import type { AddPayrollCustomFieldInput, SavePayrollInput } from "../schemas/payroll";
import {
  buildPayrollHistoryModule,
  fixedPayrollFields,
  getActiveCustomFieldsForMonth,
  type PayrollCustomFieldPeriod,
  type PayrollSection,
} from "./payroll-history";

export {
  calculatePayrollTotals,
  filterSavedLineItemsForCustomFieldPeriods,
  fixedPayrollFields,
  getFinancialYearMonths,
  resolvePayrollVersionForMonth,
  type PayrollLineItem,
  type PayrollSection,
} from "./payroll-history";

type Db = ReturnType<typeof createDb>;

type PayrollModuleOptions = {
  db?: Db;
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

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function buildPayrollFieldKeyBase(label: string) {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return slug || "field";
}

export function buildUniquePayrollFieldKey(label: string, existingKeys: Iterable<string>) {
  const baseKey = buildPayrollFieldKeyBase(label);
  const unavailableKeys = new Set(existingKeys);
  let key = baseKey;
  let suffix = 2;

  while (unavailableKeys.has(key)) {
    key = `${baseKey}_${suffix}`;
    suffix += 1;
  }

  return key;
}

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
  activeCustomFieldIds: string[];
  periods: Array<{
    customFieldDefinitionId: string;
    effectiveFromMonth: string;
    effectiveToMonth: string | null;
  }>;
}) {
  const aprilMonth = `${input.financialYearStart}-04`;
  const customFieldStarts = input.activeCustomFieldIds.map((fieldId) => {
    const periodStart =
      input.periods.find(
        (period) =>
          period.customFieldDefinitionId === fieldId &&
          period.effectiveFromMonth <= input.selectedMonth &&
          (!period.effectiveToMonth || input.selectedMonth < period.effectiveToMonth),
      )?.effectiveFromMonth ?? input.selectedMonth;

    return periodStart < aprilMonth ? aprilMonth : periodStart;
  });

  return [...new Set([aprilMonth, ...customFieldStarts])]
    .filter((effectiveMonth) => effectiveMonth <= input.selectedMonth)
    .sort();
}

export function assertNoDuplicateActivePayrollLabel(
  existingFields: Array<{
    label: string;
    section: PayrollSection;
    isActive: boolean;
  }>,
  section: PayrollSection,
  label: string,
) {
  const normalizedLabel = normalizeText(label);

  if (
    existingFields.some(
      (field) =>
        field.section === section &&
        field.isActive &&
        normalizeText(field.label) === normalizedLabel,
    )
  ) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "A payroll field with this label already exists in this section",
    });
  }
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
  const payrollHistory = buildPayrollHistoryModule({ db });

  function getCustomFieldPeriods(institutionId: string) {
    return db
      .select({
        id: payrollCustomFieldPeriods.id,
        customFieldDefinitionId: payrollCustomFieldPeriods.customFieldDefinitionId,
        effectiveFromMonth: payrollCustomFieldPeriods.effectiveFromMonth,
        effectiveToMonth: payrollCustomFieldPeriods.effectiveToMonth,
      })
      .from(payrollCustomFieldPeriods)
      .innerJoin(
        payrollCustomFieldDefinitions,
        eq(payrollCustomFieldDefinitions.id, payrollCustomFieldPeriods.customFieldDefinitionId),
      )
      .where(eq(payrollCustomFieldDefinitions.institutionId, institutionId))
      .orderBy(asc(payrollCustomFieldPeriods.effectiveFromMonth));
  }

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

  async function getCustomFieldTimeline(institutionId: string) {
    const fields = await db
      .select({
        id: payrollCustomFieldDefinitions.id,
        section: payrollCustomFieldDefinitions.section,
        label: payrollCustomFieldDefinitions.label,
        key: payrollCustomFieldDefinitions.key,
        sortOrder: payrollCustomFieldDefinitions.sortOrder,
      })
      .from(payrollCustomFieldDefinitions)
      .where(eq(payrollCustomFieldDefinitions.institutionId, institutionId))
      .orderBy(
        asc(payrollCustomFieldDefinitions.section),
        asc(payrollCustomFieldDefinitions.sortOrder),
        asc(payrollCustomFieldDefinitions.label),
      );
    const periods = await getCustomFieldPeriods(institutionId);

    return { fields, periods };
  }

  function getActiveCustomFieldPeriodForMonth(
    periods: PayrollCustomFieldPeriod[],
    customFieldDefinitionId: string,
    month: string,
  ) {
    return (
      periods.find(
        (period) =>
          period.customFieldDefinitionId === customFieldDefinitionId &&
          period.effectiveFromMonth <= month &&
          (!period.effectiveToMonth || month < period.effectiveToMonth),
      ) ?? null
    );
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
    const activeCustomFields = getActiveCustomFieldsForMonth(
      history.fields,
      history.periods,
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

    const customFieldTimeline = await getCustomFieldTimeline(institutionId);
    const activeCustomFields = getActiveCustomFieldsForMonth(
      customFieldTimeline.fields,
      customFieldTimeline.periods,
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

      for (const itemChunk of chunkForD1(items, PAYROLL_LINE_ITEM_BOUND_PARAMETERS)) {
        queries.push(
          db.insert(payrollLineItems).values(
            itemChunk.map((item) => ({
              id: crypto.randomUUID(),
              payrollVersionId,
              ...item,
            })),
          ),
        );
      }
    }

    if (existingVersions.length === 0) {
      const effectiveMonths = getInitialPayrollEffectiveMonths({
        financialYearStart: input.financialYearStart,
        selectedMonth: input.month,
        activeCustomFieldIds: activeCustomFields.map((field) => field.id),
        periods: customFieldTimeline.periods,
      });

      for (const effectiveMonth of effectiveMonths) {
        queueVersionReplacement(
          effectiveMonth,
          normalizedLineItems.filter(
            (item) =>
              !item.customFieldDefinitionId ||
              (getActiveCustomFieldPeriodForMonth(
                customFieldTimeline.periods,
                item.customFieldDefinitionId,
                input.month,
              )?.effectiveFromMonth ?? input.month) <= effectiveMonth,
          ),
        );
      }
    } else {
      queueVersionReplacement(input.month, normalizedLineItems);
    }

    const [firstQuery, ...remainingQueries] = queries;

    if (!firstQuery) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Unable to prepare payroll save",
      });
    }

    await db.batch([firstQuery, ...remainingQueries]);

    return getForm(institutionId, input.employeeId, input.financialYearStart, input.month);
  }

  async function getNextSortOrder(institutionId: string, section: PayrollSection) {
    const current = await db
      .select({ sortOrder: payrollCustomFieldDefinitions.sortOrder })
      .from(payrollCustomFieldDefinitions)
      .where(
        and(
          eq(payrollCustomFieldDefinitions.institutionId, institutionId),
          eq(payrollCustomFieldDefinitions.section, section),
        ),
      )
      .orderBy(desc(payrollCustomFieldDefinitions.sortOrder))
      .get();

    return (current?.sortOrder ?? 0) + 1;
  }

  async function addCustomField(institutionId: string, input: AddPayrollCustomFieldInput) {
    const existingFields = await db
      .select({
        id: payrollCustomFieldDefinitions.id,
        label: payrollCustomFieldDefinitions.label,
        key: payrollCustomFieldDefinitions.key,
        section: payrollCustomFieldDefinitions.section,
        sortOrder: payrollCustomFieldDefinitions.sortOrder,
      })
      .from(payrollCustomFieldDefinitions)
      .where(eq(payrollCustomFieldDefinitions.institutionId, institutionId));

    const periods = await getCustomFieldPeriods(institutionId);
    const matchingFields = existingFields.filter(
      (field) =>
        field.section === input.section &&
        normalizeText(field.label) === normalizeText(input.label),
    );

    if (
      matchingFields.some((field) =>
        getActiveCustomFieldPeriodForMonth(periods, field.id, input.month),
      )
    ) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "A payroll field with this label already exists in this section",
      });
    }

    let field = matchingFields[0];
    const fieldQueries: BatchItem<"sqlite">[] = [];

    if (!field) {
      field = {
        id: crypto.randomUUID(),
        section: input.section,
        label: input.label.trim(),
        key: buildUniquePayrollFieldKey(
          input.label,
          existingFields.map((existingField) => existingField.key),
        ),
        sortOrder: await getNextSortOrder(institutionId, input.section),
      };
      fieldQueries.push(
        db.insert(payrollCustomFieldDefinitions).values({
          ...field,
          institutionId,
        }),
      );
    } else {
      fieldQueries.push(
        db
          .update(payrollCustomFieldDefinitions)
          .set({ isActive: true })
          .where(eq(payrollCustomFieldDefinitions.id, field.id)),
      );
    }

    if (!field) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Unable to create payroll field",
      });
    }

    const nextPeriod = periods
      .filter(
        (period) =>
          period.customFieldDefinitionId === field.id && period.effectiveFromMonth > input.month,
      )
      .sort((left, right) => left.effectiveFromMonth.localeCompare(right.effectiveFromMonth))[0];

    fieldQueries.push(
      db.insert(payrollCustomFieldPeriods).values({
        id: crypto.randomUUID(),
        customFieldDefinitionId: field.id,
        effectiveFromMonth: input.month,
        effectiveToMonth: nextPeriod?.effectiveFromMonth ?? null,
      }),
    );
    const [firstFieldQuery, ...remainingFieldQueries] = fieldQueries;

    if (!firstFieldQuery) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Unable to prepare payroll field",
      });
    }

    await db.batch([firstFieldQuery, ...remainingFieldQueries]);

    return field;
  }

  async function archiveCustomField(institutionId: string, input: { id: string; month: string }) {
    const field = await db
      .select()
      .from(payrollCustomFieldDefinitions)
      .where(
        and(
          eq(payrollCustomFieldDefinitions.id, input.id),
          eq(payrollCustomFieldDefinitions.institutionId, institutionId),
        ),
      )
      .get();

    if (!field) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Payroll field was not found",
      });
    }

    const periods = await db
      .select({
        id: payrollCustomFieldPeriods.id,
        customFieldDefinitionId: payrollCustomFieldPeriods.customFieldDefinitionId,
        effectiveFromMonth: payrollCustomFieldPeriods.effectiveFromMonth,
        effectiveToMonth: payrollCustomFieldPeriods.effectiveToMonth,
      })
      .from(payrollCustomFieldPeriods)
      .where(eq(payrollCustomFieldPeriods.customFieldDefinitionId, input.id));
    const activePeriod = getActiveCustomFieldPeriodForMonth(periods, input.id, input.month);

    if (!activePeriod) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Payroll field was not active for this month",
      });
    }

    const archivePeriodQuery =
      activePeriod.effectiveFromMonth === input.month
        ? db
            .delete(payrollCustomFieldPeriods)
            .where(eq(payrollCustomFieldPeriods.id, activePeriod.id))
        : db
            .update(payrollCustomFieldPeriods)
            .set({ effectiveToMonth: input.month })
            .where(eq(payrollCustomFieldPeriods.id, activePeriod.id));
    const hasLaterOpenPeriod = periods.some(
      (period) =>
        period.id !== activePeriod.id &&
        period.effectiveFromMonth > input.month &&
        !period.effectiveToMonth,
    );

    await db.batch([
      archivePeriodQuery,
      db
        .update(payrollCustomFieldDefinitions)
        .set({ isActive: hasLaterOpenPeriod })
        .where(eq(payrollCustomFieldDefinitions.id, input.id)),
    ]);

    return field;
  }

  return {
    getEmployees,
    getForm,
    save,
    addCustomField,
    archiveCustomField,
  };
}

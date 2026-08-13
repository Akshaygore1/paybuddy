import { createDb } from "@tds-nivaran/db";
import {
  employeePayrollProfiles,
  employeePayrollVersions,
  employees,
  institutions,
  payrollCustomFieldDefinitions,
  payrollCustomFieldPeriods,
  payrollLineItems,
} from "@tds-nivaran/db/schema/index";
import { TRPCError } from "@trpc/server";
import type { BatchItem } from "drizzle-orm/batch";
import { and, asc, desc, eq, inArray } from "drizzle-orm";

import type { AddPayrollCustomFieldInput, SavePayrollInput } from "../schemas/payroll";

type Db = ReturnType<typeof createDb>;

type PayrollModuleOptions = {
  db?: Db;
};

export const fixedPayrollFields = {
  earnings: [
    { key: "basicPay", label: "Basic Pay" },
    { key: "da", label: "D.A." },
    { key: "daDifferenceArrears", label: "D.A. Difference Arrears" },
    { key: "hra", label: "HRA" },
    { key: "cla", label: "C.L.A" },
    { key: "vaTaArrear", label: "V.A/T.A. Arrear" },
  ],
  deductions: [
    { key: "recovery", label: "Recovery" },
    { key: "gpf", label: "G.P.F" },
    { key: "rd", label: "R.D" },
    { key: "cmFund", label: "C.M. Fund" },
    { key: "incomeTax", label: "Income Tax / TDS" },
    { key: "professionalTax", label: "Professional Tax" },
    { key: "lic", label: "L.I.C" },
  ],
} as const;

export type PayrollSection = keyof typeof fixedPayrollFields;

export type PayrollLineItem = {
  id: string;
  section: PayrollSection;
  fixedFieldKey: string | null;
  customFieldDefinitionId: string | null;
  label: string;
  amountPaise: number;
  sortOrder: number;
};

type PayrollCustomField = {
  id: string;
  section: PayrollSection;
  label: string;
  key: string;
  sortOrder: number;
};

type PayrollCustomFieldPeriod = {
  id: string;
  customFieldDefinitionId: string;
  effectiveFromMonth: string;
  effectiveToMonth: string | null;
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

export function getFinancialYearMonths(financialYearStart: number) {
  return Array.from({ length: 12 }, (_, index) => {
    const monthIndex = (3 + index) % 12;
    const year = index < 9 ? financialYearStart : financialYearStart + 1;
    const date = new Date(Date.UTC(year, monthIndex, 1));

    return {
      value: `${year}-${String(monthIndex + 1).padStart(2, "0")}`,
      label: new Intl.DateTimeFormat("en-IN", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }).format(date),
      monthIndex,
      year,
    };
  });
}

export function resolvePayrollVersionForMonth<TVersion extends { effectiveMonth: string }>(
  versions: TVersion[],
  month: string,
): TVersion | null {
  return (
    versions
      .filter((version) => version.effectiveMonth <= month)
      .sort((left, right) => right.effectiveMonth.localeCompare(left.effectiveMonth))[0] ?? null
  );
}

export function filterSavedLineItemsForCustomFieldPeriods<
  TLineItem extends { customFieldDefinitionId: string | null },
>(input: {
  savedLineItems: TLineItem[];
  versionEffectiveMonth: string;
  month: string;
  periods: Array<{
    customFieldDefinitionId: string;
    effectiveFromMonth: string;
    effectiveToMonth: string | null;
  }>;
}) {
  return input.savedLineItems.filter((item) => {
    if (!item.customFieldDefinitionId) {
      return true;
    }

    const fieldPeriods = input.periods.filter(
      (period) => period.customFieldDefinitionId === item.customFieldDefinitionId,
    );

    if (fieldPeriods.length === 0) {
      return true;
    }

    const activePeriod = fieldPeriods.find(
      (period) =>
        period.effectiveFromMonth <= input.month &&
        (!period.effectiveToMonth || input.month < period.effectiveToMonth),
    );

    return Boolean(activePeriod && input.versionEffectiveMonth >= activePeriod.effectiveFromMonth);
  });
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

export function calculatePayrollTotals(
  lineItems: Array<{ section: PayrollSection; amountPaise: number }>,
) {
  const earningsPaise = lineItems
    .filter((item) => item.section === "earnings")
    .reduce((total, item) => total + item.amountPaise, 0);
  const deductionsPaise = lineItems
    .filter((item) => item.section === "deductions")
    .reduce((total, item) => total + item.amountPaise, 0);

  return {
    earningsPaise,
    deductionsPaise,
    netPayPaise: earningsPaise - deductionsPaise,
  };
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

function toLineItemsWithDefaults(input: {
  activeCustomFields: Array<{
    id: string;
    section: PayrollSection;
    label: string;
    sortOrder: number;
  }>;
  savedLineItems: PayrollLineItem[];
}) {
  const savedByFixedKey = new Map(
    input.savedLineItems
      .filter((item) => item.fixedFieldKey)
      .map((item) => [`${item.section}:${item.fixedFieldKey}`, item]),
  );
  const savedByCustomFieldId = new Map(
    input.savedLineItems
      .filter((item) => item.customFieldDefinitionId)
      .map((item) => [item.customFieldDefinitionId, item]),
  );
  const activeCustomFieldIds = new Set(input.activeCustomFields.map((field) => field.id));
  const archivedSavedCustomItems = input.savedLineItems.filter(
    (item) =>
      item.customFieldDefinitionId && !activeCustomFieldIds.has(item.customFieldDefinitionId),
  );

  return [
    ...Object.entries(fixedPayrollFields).flatMap(([section, fields]) =>
      fields.map((field, index) => {
        const saved = savedByFixedKey.get(`${section}:${field.key}`);

        return {
          id: saved?.id ?? `fixed:${section}:${field.key}`,
          section: section as PayrollSection,
          fixedFieldKey: field.key,
          customFieldDefinitionId: null,
          label: field.label,
          amountPaise: saved?.amountPaise ?? 0,
          sortOrder: index + 1,
          isArchivedCustomField: false,
        };
      }),
    ),
    ...input.activeCustomFields.map((field) => {
      const saved = savedByCustomFieldId.get(field.id);

      return {
        id: saved?.id ?? `custom:${field.id}`,
        section: field.section,
        fixedFieldKey: null,
        customFieldDefinitionId: field.id,
        label: field.label,
        amountPaise: saved?.amountPaise ?? 0,
        sortOrder: 1000 + field.sortOrder,
        isArchivedCustomField: false,
      };
    }),
    ...archivedSavedCustomItems.map((item) => ({
      ...item,
      isArchivedCustomField: true,
    })),
  ].sort((left, right) =>
    left.section === right.section
      ? left.sortOrder - right.sortOrder || left.label.localeCompare(right.label)
      : left.section.localeCompare(right.section),
  );
}

export function buildPayrollModule(options: PayrollModuleOptions = {}) {
  const db = options.db ?? createDb();

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
    const fieldIds = fields.map((field) => field.id);
    const periods =
      fieldIds.length > 0
        ? await db
            .select({
              id: payrollCustomFieldPeriods.id,
              customFieldDefinitionId: payrollCustomFieldPeriods.customFieldDefinitionId,
              effectiveFromMonth: payrollCustomFieldPeriods.effectiveFromMonth,
              effectiveToMonth: payrollCustomFieldPeriods.effectiveToMonth,
            })
            .from(payrollCustomFieldPeriods)
            .where(inArray(payrollCustomFieldPeriods.customFieldDefinitionId, fieldIds))
            .orderBy(asc(payrollCustomFieldPeriods.effectiveFromMonth))
        : [];

    return { fields, periods };
  }

  function getActiveCustomFieldsForMonth(
    fields: PayrollCustomField[],
    periods: PayrollCustomFieldPeriod[],
    month: string,
  ) {
    const activeIds = new Set(
      periods
        .filter(
          (period) =>
            period.effectiveFromMonth <= month &&
            (!period.effectiveToMonth || month < period.effectiveToMonth),
        )
        .map((period) => period.customFieldDefinitionId),
    );

    return fields.filter((field) => activeIds.has(field.id));
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

  async function getSavedLineItems(versionId: string | undefined): Promise<PayrollLineItem[]> {
    if (!versionId) {
      return [];
    }

    return db
      .select({
        id: payrollLineItems.id,
        section: payrollLineItems.section,
        fixedFieldKey: payrollLineItems.fixedFieldKey,
        customFieldDefinitionId: payrollLineItems.customFieldDefinitionId,
        label: payrollLineItems.label,
        amountPaise: payrollLineItems.amountPaise,
        sortOrder: payrollLineItems.sortOrder,
      })
      .from(payrollLineItems)
      .where(eq(payrollLineItems.payrollVersionId, versionId))
      .orderBy(
        asc(payrollLineItems.section),
        asc(payrollLineItems.sortOrder),
        asc(payrollLineItems.label),
      );
  }

  async function getForm(
    institutionId: string,
    employeeId: string,
    financialYearStart: number,
    month: string,
  ) {
    const [institution, employee, customFieldTimeline, profile] = await Promise.all([
      db
        .select({
          id: institutions.id,
          name: institutions.name,
          tanNumber: institutions.tanNumber,
          address: institutions.address,
        })
        .from(institutions)
        .where(eq(institutions.id, institutionId))
        .get(),
      getEmployee(institutionId, employeeId),
      getCustomFieldTimeline(institutionId),
      getProfile(employeeId, financialYearStart),
    ]);

    if (!institution) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Institution not found",
      });
    }

    const months = getFinancialYearMonths(financialYearStart);
    const versions = await getVersions(profile?.id);
    const lineItemsByVersionId = new Map<string, PayrollLineItem[]>();

    await Promise.all(
      versions.map(async (version) => {
        lineItemsByVersionId.set(version.id, await getSavedLineItems(version.id));
      }),
    );

    const monthlyPayroll = months.map((monthDefinition) => {
      const version = resolvePayrollVersionForMonth(versions, monthDefinition.value);
      const rawSavedLineItems = version ? (lineItemsByVersionId.get(version.id) ?? []) : [];
      const savedLineItems = version
        ? filterSavedLineItemsForCustomFieldPeriods({
            savedLineItems: rawSavedLineItems,
            versionEffectiveMonth: version.effectiveMonth,
            month: monthDefinition.value,
            periods: customFieldTimeline.periods,
          })
        : [];
      const activeCustomFields = getActiveCustomFieldsForMonth(
        customFieldTimeline.fields,
        customFieldTimeline.periods,
        monthDefinition.value,
      );
      const lineItems = toLineItemsWithDefaults({
        activeCustomFields,
        savedLineItems,
      }).filter(
        (item) =>
          !item.customFieldDefinitionId ||
          activeCustomFields.some((field) => field.id === item.customFieldDefinitionId) ||
          !customFieldTimeline.periods.some(
            (period) => period.customFieldDefinitionId === item.customFieldDefinitionId,
          ),
      );

      return {
        month: monthDefinition.value,
        effectiveMonth: version?.effectiveMonth ?? null,
        hasSavedPayroll: Boolean(version),
        lineItems,
        totals: calculatePayrollTotals(lineItems),
      };
    });
    const selectedPayroll = monthlyPayroll.find((payroll) => payroll.month === month);

    if (!selectedPayroll) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Month must belong to the financial year",
      });
    }
    const activeCustomFields = getActiveCustomFieldsForMonth(
      customFieldTimeline.fields,
      customFieldTimeline.periods,
      month,
    );

    return {
      institution,
      employee,
      financialYearStart,
      month,
      profileId: profile?.id ?? null,
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

      if (items.length > 0) {
        queries.push(
          db.insert(payrollLineItems).values(
            items.map((item) => ({
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

    const periods =
      existingFields.length > 0
        ? await db
            .select({
              id: payrollCustomFieldPeriods.id,
              customFieldDefinitionId: payrollCustomFieldPeriods.customFieldDefinitionId,
              effectiveFromMonth: payrollCustomFieldPeriods.effectiveFromMonth,
              effectiveToMonth: payrollCustomFieldPeriods.effectiveToMonth,
            })
            .from(payrollCustomFieldPeriods)
            .where(
              inArray(
                payrollCustomFieldPeriods.customFieldDefinitionId,
                existingFields.map((field) => field.id),
              ),
            )
        : [];
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

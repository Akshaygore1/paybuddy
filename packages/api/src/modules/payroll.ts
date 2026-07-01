import { createDb } from "@paybuddy/db";
import {
  employeePayrollProfiles,
  employees,
  institutions,
  payrollCustomFieldDefinitions,
  payrollLineItems,
} from "@paybuddy/db/schema/index";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, inArray } from "drizzle-orm";

import type {
  AddPayrollCustomFieldInput,
  SavePayrollInput,
} from "../schemas/payroll";

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

export function buildUniquePayrollFieldKey(
  label: string,
  existingKeys: Iterable<string>,
) {
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

export function calculateAnnualTotals(
  totals: ReturnType<typeof calculatePayrollTotals>,
) {
  return {
    earningsPaise: totals.earningsPaise * 12,
    deductionsPaise: totals.deductionsPaise * 12,
    netPayPaise: totals.netPayPaise * 12,
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

function getEmployeeName(employee: {
  firstName: string;
  middleName: string;
  surname: string;
}) {
  return [employee.firstName, employee.middleName, employee.surname]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");
}

function getFixedField(
  section: PayrollSection,
  fixedFieldKey: string | null | undefined,
) {
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
  const activeCustomFieldIds = new Set(
    input.activeCustomFields.map((field) => field.id),
  );
  const archivedSavedCustomItems = input.savedLineItems.filter(
    (item) =>
      item.customFieldDefinitionId &&
      !activeCustomFieldIds.has(item.customFieldDefinitionId),
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
      ? left.sortOrder - right.sortOrder ||
        left.label.localeCompare(right.label)
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
      .orderBy(
        asc(employees.seniorityRank),
        asc(employees.surname),
        asc(employees.firstName),
      );
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
      .where(
        and(
          eq(employees.id, employeeId),
          eq(employees.institutionId, institutionId),
        ),
      )
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

  async function getActiveCustomFields(institutionId: string) {
    return db
      .select({
        id: payrollCustomFieldDefinitions.id,
        section: payrollCustomFieldDefinitions.section,
        label: payrollCustomFieldDefinitions.label,
        key: payrollCustomFieldDefinitions.key,
        sortOrder: payrollCustomFieldDefinitions.sortOrder,
      })
      .from(payrollCustomFieldDefinitions)
      .where(
        and(
          eq(payrollCustomFieldDefinitions.institutionId, institutionId),
          eq(payrollCustomFieldDefinitions.isActive, true),
        ),
      )
      .orderBy(
        asc(payrollCustomFieldDefinitions.section),
        asc(payrollCustomFieldDefinitions.sortOrder),
        asc(payrollCustomFieldDefinitions.label),
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

  async function getSavedLineItems(
    profileId: string | undefined,
  ): Promise<PayrollLineItem[]> {
    if (!profileId) {
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
      .where(eq(payrollLineItems.payrollProfileId, profileId))
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
  ) {
    const [institution, employee, activeCustomFields, profile] =
      await Promise.all([
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
        getActiveCustomFields(institutionId),
        getProfile(employeeId, financialYearStart),
      ]);

    if (!institution) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Institution not found",
      });
    }

    const savedLineItems = await getSavedLineItems(profile?.id);
    const lineItems = toLineItemsWithDefaults({
      activeCustomFields,
      savedLineItems,
    });
    const savedAmountLineItems = savedLineItems.filter(
      (item) => item.amountPaise > 0,
    );

    return {
      institution,
      employee,
      financialYearStart,
      profileId: profile?.id ?? null,
      hasSavedPayroll: Boolean(profile),
      fixedFields: fixedPayrollFields,
      customFields: activeCustomFields,
      lineItems,
      totals: calculatePayrollTotals(lineItems),
      savedTotals: calculatePayrollTotals(savedLineItems),
      hasSavedAmounts: savedAmountLineItems.length > 0,
      months: getFinancialYearMonths(financialYearStart),
    };
  }

  async function save(institutionId: string, input: SavePayrollInput) {
    await getEmployee(institutionId, input.employeeId);

    const activeCustomFields = await getActiveCustomFields(institutionId);
    const activeCustomFieldIds = new Set(
      activeCustomFields.map((field) => field.id),
    );
    const activeCustomFieldsById = new Map(
      activeCustomFields.map((field) => [field.id, field]),
    );

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

      const customField = customFieldId
        ? activeCustomFieldsById.get(customFieldId)
        : null;

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
        sortOrder:
          fixedField?.sortOrder ?? 1000 + (customField?.sortOrder ?? 0),
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

    let profile = await getProfile(input.employeeId, input.financialYearStart);

    if (!profile) {
      const [createdProfile] = await db
        .insert(employeePayrollProfiles)
        .values({
          id: crypto.randomUUID(),
          institutionId,
          employeeId: input.employeeId,
          financialYearStart: input.financialYearStart,
        })
        .returning({
          id: employeePayrollProfiles.id,
          financialYearStart: employeePayrollProfiles.financialYearStart,
        });

      if (!createdProfile) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Unable to create payroll profile",
        });
      }

      profile = createdProfile;
    }

    const existingLineItems = await getSavedLineItems(profile.id);
    const activeCustomIdsForDelete = existingLineItems
      .filter(
        (item) =>
          item.fixedFieldKey ||
          (item.customFieldDefinitionId &&
            activeCustomFieldIds.has(item.customFieldDefinitionId)),
      )
      .map((item) => item.id);

    if (activeCustomIdsForDelete.length > 0) {
      await db
        .delete(payrollLineItems)
        .where(inArray(payrollLineItems.id, activeCustomIdsForDelete));
    }

    const lineItemsToInsert = normalizedLineItems
      .filter((item) => item.amountPaise > 0)
      .map((item) => ({
        id: crypto.randomUUID(),
        payrollProfileId: profile.id,
        ...item,
      }));

    if (lineItemsToInsert.length > 0) {
      await db.insert(payrollLineItems).values(lineItemsToInsert);
    }

    return getForm(institutionId, input.employeeId, input.financialYearStart);
  }

  async function getNextSortOrder(
    institutionId: string,
    section: PayrollSection,
  ) {
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

  async function addCustomField(
    institutionId: string,
    input: AddPayrollCustomFieldInput,
  ) {
    const existingFields = await db
      .select({
        label: payrollCustomFieldDefinitions.label,
        key: payrollCustomFieldDefinitions.key,
        section: payrollCustomFieldDefinitions.section,
        isActive: payrollCustomFieldDefinitions.isActive,
      })
      .from(payrollCustomFieldDefinitions)
      .where(eq(payrollCustomFieldDefinitions.institutionId, institutionId));

    assertNoDuplicateActivePayrollLabel(
      existingFields,
      input.section,
      input.label,
    );

    const [createdField] = await db
      .insert(payrollCustomFieldDefinitions)
      .values({
        id: crypto.randomUUID(),
        institutionId,
        section: input.section,
        label: input.label.trim(),
        key: buildUniquePayrollFieldKey(
          input.label,
          existingFields.map((field) => field.key),
        ),
        sortOrder: await getNextSortOrder(institutionId, input.section),
      })
      .returning();

    return createdField;
  }

  async function archiveCustomField(institutionId: string, id: string) {
    const [archivedField] = await db
      .update(payrollCustomFieldDefinitions)
      .set({ isActive: false })
      .where(
        and(
          eq(payrollCustomFieldDefinitions.id, id),
          eq(payrollCustomFieldDefinitions.institutionId, institutionId),
          eq(payrollCustomFieldDefinitions.isActive, true),
        ),
      )
      .returning();

    if (!archivedField) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Payroll field was not found",
      });
    }

    return archivedField;
  }

  return {
    getEmployees,
    getForm,
    save,
    addCustomField,
    archiveCustomField,
  };
}

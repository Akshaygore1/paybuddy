import { createDb } from "@tds-nivaran/db";
import { chunkForD1 } from "@tds-nivaran/db/d1";
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
import { and, asc, eq, inArray } from "drizzle-orm";

type Db = ReturnType<typeof createDb>;

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

export type PayrollCustomField = {
  id: string;
  section: PayrollSection;
  label: string;
  key: string;
  sortOrder: number;
};

export type PayrollCustomFieldPeriod = {
  id: string;
  customFieldDefinitionId: string;
  effectiveFromMonth: string;
  effectiveToMonth: string | null;
};

type PayrollVersion = {
  id: string;
  payrollProfileId: string;
  effectiveMonth: string;
};

type SavedPayrollLineItem = PayrollLineItem & { payrollVersionId: string };

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
  let resolved: TVersion | null = null;

  for (const version of versions) {
    if (
      version.effectiveMonth <= month &&
      (!resolved || version.effectiveMonth > resolved.effectiveMonth)
    ) {
      resolved = version;
    }
  }

  return resolved;
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
  const periodsByFieldId = new Map<string, typeof input.periods>();

  for (const period of input.periods) {
    const current = periodsByFieldId.get(period.customFieldDefinitionId) ?? [];
    current.push(period);
    periodsByFieldId.set(period.customFieldDefinitionId, current);
  }

  return input.savedLineItems.filter((item) => {
    if (!item.customFieldDefinitionId) return true;

    const fieldPeriods = periodsByFieldId.get(item.customFieldDefinitionId) ?? [];
    if (fieldPeriods.length === 0) return true;

    const activePeriod = fieldPeriods.find(
      (period) =>
        period.effectiveFromMonth <= input.month &&
        (!period.effectiveToMonth || input.month < period.effectiveToMonth),
    );

    return Boolean(activePeriod && input.versionEffectiveMonth >= activePeriod.effectiveFromMonth);
  });
}

export function calculatePayrollTotals(
  lineItems: Array<{ section: PayrollSection; amountPaise: number }>,
) {
  let earningsPaise = 0;
  let deductionsPaise = 0;

  for (const item of lineItems) {
    if (item.section === "earnings") earningsPaise += item.amountPaise;
    else deductionsPaise += item.amountPaise;
  }

  return {
    earningsPaise,
    deductionsPaise,
    netPayPaise: earningsPaise - deductionsPaise,
  };
}

export function getActiveCustomFieldsForMonth(
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

function getEmployeeName(employee: { firstName: string; middleName: string; surname: string }) {
  return [employee.firstName, employee.middleName, employee.surname]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");
}

function toLineItemsWithDefaults(input: {
  activeCustomFields: PayrollCustomField[];
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
    ...archivedSavedCustomItems.map((item) => ({ ...item, isArchivedCustomField: true })),
  ].sort((left, right) =>
    left.section === right.section
      ? left.sortOrder - right.sortOrder || left.label.localeCompare(right.label)
      : left.section.localeCompare(right.section),
  );
}

function projectEmployeeHistory(input: {
  employee: { id: string; firstName: string; middleName: string; surname: string };
  profileId: string | null;
  financialYearStart: number;
  fields: PayrollCustomField[];
  periods: PayrollCustomFieldPeriod[];
  versions: PayrollVersion[];
  lineItemsByVersionId: Map<string, SavedPayrollLineItem[]>;
}) {
  const months = getFinancialYearMonths(input.financialYearStart);
  const monthlyPayroll = months.map((monthDefinition) => {
    const version = resolvePayrollVersionForMonth(input.versions, monthDefinition.value);
    const rawSavedLineItems = version ? (input.lineItemsByVersionId.get(version.id) ?? []) : [];
    const savedLineItems = version
      ? filterSavedLineItemsForCustomFieldPeriods({
          savedLineItems: rawSavedLineItems,
          versionEffectiveMonth: version.effectiveMonth,
          month: monthDefinition.value,
          periods: input.periods,
        })
      : [];
    const activeCustomFields = getActiveCustomFieldsForMonth(
      input.fields,
      input.periods,
      monthDefinition.value,
    );
    const lineItems = toLineItemsWithDefaults({ activeCustomFields, savedLineItems }).filter(
      (item) =>
        !item.customFieldDefinitionId ||
        activeCustomFields.some((field) => field.id === item.customFieldDefinitionId) ||
        !input.periods.some(
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

  const annualTotals = monthlyPayroll.reduce(
    (totals, payroll) => ({
      earningsPaise: totals.earningsPaise + payroll.totals.earningsPaise,
      deductionsPaise: totals.deductionsPaise + payroll.totals.deductionsPaise,
      netPayPaise: totals.netPayPaise + payroll.totals.netPayPaise,
    }),
    { earningsPaise: 0, deductionsPaise: 0, netPayPaise: 0 },
  );

  return {
    employee: { ...input.employee, name: getEmployeeName(input.employee) },
    financialYearStart: input.financialYearStart,
    profileId: input.profileId,
    months,
    monthlyPayroll,
    annualTotals,
  };
}

export function buildPayrollHistoryModule(options: { db?: Db } = {}) {
  const db = options.db ?? createDb();

  async function getTimeline(institutionId: string) {
    const [fields, periods] = await Promise.all([
      db
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
        ),
      db
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
        .orderBy(asc(payrollCustomFieldPeriods.effectiveFromMonth)),
    ]);
    return { fields, periods };
  }

  async function loadVersionsAndItems(profileIds: string[]) {
    if (profileIds.length === 0) return { versions: [], lineItemsByVersionId: new Map() };

    const versions = (
      await Promise.all(
        chunkForD1(profileIds, 1).map((profileIdChunk) =>
          db
            .select({
              id: employeePayrollVersions.id,
              payrollProfileId: employeePayrollVersions.payrollProfileId,
              effectiveMonth: employeePayrollVersions.effectiveMonth,
            })
            .from(employeePayrollVersions)
            .where(inArray(employeePayrollVersions.payrollProfileId, profileIdChunk))
            .orderBy(asc(employeePayrollVersions.effectiveMonth)),
        ),
      )
    ).flat();
    const versionIds = versions.map((version) => version.id);
    const items =
      versionIds.length === 0
        ? []
        : (
            await Promise.all(
              chunkForD1(versionIds, 1).map((versionIdChunk) =>
                db
                  .select({
                    id: payrollLineItems.id,
                    payrollVersionId: payrollLineItems.payrollVersionId,
                    section: payrollLineItems.section,
                    fixedFieldKey: payrollLineItems.fixedFieldKey,
                    customFieldDefinitionId: payrollLineItems.customFieldDefinitionId,
                    label: payrollLineItems.label,
                    amountPaise: payrollLineItems.amountPaise,
                    sortOrder: payrollLineItems.sortOrder,
                  })
                  .from(payrollLineItems)
                  .where(inArray(payrollLineItems.payrollVersionId, versionIdChunk))
                  .orderBy(
                    asc(payrollLineItems.section),
                    asc(payrollLineItems.sortOrder),
                    asc(payrollLineItems.label),
                  ),
              ),
            )
          ).flat();
    const lineItemsByVersionId = new Map<string, SavedPayrollLineItem[]>();
    for (const item of items) {
      const current = lineItemsByVersionId.get(item.payrollVersionId) ?? [];
      current.push(item);
      lineItemsByVersionId.set(item.payrollVersionId, current);
    }
    return { versions, lineItemsByVersionId };
  }

  async function getEmployeeFinancialYear(
    institutionId: string,
    employeeId: string,
    financialYearStart: number,
  ) {
    const [institution, employee, timeline, profile] = await Promise.all([
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
      db
        .select({
          id: employees.id,
          firstName: employees.firstName,
          middleName: employees.middleName,
          surname: employees.surname,
        })
        .from(employees)
        .where(and(eq(employees.id, employeeId), eq(employees.institutionId, institutionId)))
        .get(),
      getTimeline(institutionId),
      db
        .select({ id: employeePayrollProfiles.id })
        .from(employeePayrollProfiles)
        .where(
          and(
            eq(employeePayrollProfiles.institutionId, institutionId),
            eq(employeePayrollProfiles.employeeId, employeeId),
            eq(employeePayrollProfiles.financialYearStart, financialYearStart),
          ),
        )
        .get(),
    ]);

    if (!institution) throw new TRPCError({ code: "NOT_FOUND", message: "Institution not found" });
    if (!employee) throw new TRPCError({ code: "NOT_FOUND", message: "Employee not found" });

    const loaded = await loadVersionsAndItems(profile ? [profile.id] : []);
    return {
      institution,
      ...projectEmployeeHistory({
        employee,
        profileId: profile?.id ?? null,
        financialYearStart,
        fields: timeline.fields,
        periods: timeline.periods,
        versions: loaded.versions,
        lineItemsByVersionId: loaded.lineItemsByVersionId,
      }),
      fields: timeline.fields,
      periods: timeline.periods,
    };
  }

  async function getInstitutionFinancialYear(institutionId: string, financialYearStart: number) {
    const [institution, employeeRows, timeline, profiles] = await Promise.all([
      db
        .select({ id: institutions.id, name: institutions.name })
        .from(institutions)
        .where(eq(institutions.id, institutionId))
        .get(),
      db
        .select({
          id: employees.id,
          firstName: employees.firstName,
          middleName: employees.middleName,
          surname: employees.surname,
          seniorityRank: employees.seniorityRank,
        })
        .from(employees)
        .where(eq(employees.institutionId, institutionId))
        .orderBy(asc(employees.seniorityRank), asc(employees.surname), asc(employees.firstName)),
      getTimeline(institutionId),
      db
        .select({ id: employeePayrollProfiles.id, employeeId: employeePayrollProfiles.employeeId })
        .from(employeePayrollProfiles)
        .where(
          and(
            eq(employeePayrollProfiles.institutionId, institutionId),
            eq(employeePayrollProfiles.financialYearStart, financialYearStart),
          ),
        ),
    ]);

    if (!institution) throw new TRPCError({ code: "NOT_FOUND", message: "Institute not found" });

    const loaded = await loadVersionsAndItems(profiles.map((profile) => profile.id));
    const profileByEmployeeId = new Map(profiles.map((profile) => [profile.employeeId, profile]));
    const versionsByProfileId = new Map<string, PayrollVersion[]>();
    for (const version of loaded.versions) {
      const current = versionsByProfileId.get(version.payrollProfileId) ?? [];
      current.push(version);
      versionsByProfileId.set(version.payrollProfileId, current);
    }

    return {
      institution,
      financialYearStart,
      employees: employeeRows.map((employee) => {
        const profile = profileByEmployeeId.get(employee.id);
        return {
          seniorityRank: employee.seniorityRank,
          ...projectEmployeeHistory({
            employee,
            profileId: profile?.id ?? null,
            financialYearStart,
            fields: timeline.fields,
            periods: timeline.periods,
            versions: profile ? (versionsByProfileId.get(profile.id) ?? []) : [],
            lineItemsByVersionId: loaded.lineItemsByVersionId,
          }),
        };
      }),
    };
  }

  return { getEmployeeFinancialYear, getInstitutionFinancialYear };
}

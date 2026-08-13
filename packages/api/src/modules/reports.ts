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
import { and, asc, eq } from "drizzle-orm";

import type { ReportInput } from "../schemas/reports";
import {
  calculatePayrollTotals,
  filterSavedLineItemsForCustomFieldPeriods,
  getFinancialYearMonths,
  resolvePayrollVersionForMonth,
} from "./payroll";

type Db = ReturnType<typeof createDb>;

type ReportsModuleOptions = {
  db?: Db;
};

type ReportUser = {
  id: string;
  role: "admin" | "user";
};

type EmployeeRecord = {
  id: string;
  firstName: string;
  middleName: string;
  surname: string;
  seniorityRank: number;
};

type PayrollProfileRecord = {
  id: string;
  employeeId: string;
};

type PayrollLineItemRecord = {
  payrollVersionId: string;
  section: "earnings" | "deductions";
  fixedFieldKey: string | null;
  customFieldDefinitionId: string | null;
  amountPaise: number;
};

type PayrollCustomFieldPeriodRecord = {
  customFieldDefinitionId: string;
  effectiveFromMonth: string;
  effectiveToMonth: string | null;
};

type PayrollVersionRecord = {
  id: string;
  payrollProfileId: string;
  effectiveMonth: string;
};

const INCOME_TAX_DEDUCTION_KEY = "incomeTax";

export const fy2026NewRegimeTaxConstants = {
  financialYearStart: 2026,
  standardDeductionPaise: 75_000 * 100,
  rebateLimitPaise: 60_000 * 100,
  rebateTaxableIncomeLimitPaise: 12_00_000 * 100,
  cessRate: 0.04,
  slabs: [
    { upToPaise: 4_00_000 * 100, rate: 0 },
    { upToPaise: 8_00_000 * 100, rate: 0.05 },
    { upToPaise: 12_00_000 * 100, rate: 0.1 },
    { upToPaise: 16_00_000 * 100, rate: 0.15 },
    { upToPaise: 20_00_000 * 100, rate: 0.2 },
    { upToPaise: 24_00_000 * 100, rate: 0.25 },
    { upToPaise: Number.POSITIVE_INFINITY, rate: 0.3 },
  ],
  sources: [
    "Finance Bill 2026, First Schedule / section 115BAC references for FY 2026-27 rates.",
    "Cross-check: Income Tax Department salaried individuals slab page, labelled AY 2026-27.",
  ],
} as const;

function assertSupportedFinancialYear(financialYearStart: number) {
  if (financialYearStart !== fy2026NewRegimeTaxConstants.financialYearStart) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Reports tax calculation is currently available for FY 2026-2027",
    });
  }
}

export function calculateNewRegimeTaxPaise(
  annualGrossSalaryPaise: number,
  financialYearStart: number,
) {
  assertSupportedFinancialYear(financialYearStart);

  const constants = fy2026NewRegimeTaxConstants;
  const taxableIncomePaise = Math.max(annualGrossSalaryPaise - constants.standardDeductionPaise, 0);
  let previousLimitPaise = 0;
  let taxBeforeRebatePaise = 0;

  for (const slab of constants.slabs) {
    const slabIncomePaise = Math.max(
      Math.min(taxableIncomePaise, slab.upToPaise) - previousLimitPaise,
      0,
    );
    taxBeforeRebatePaise += slabIncomePaise * slab.rate;

    if (taxableIncomePaise <= slab.upToPaise) {
      break;
    }

    previousLimitPaise = slab.upToPaise;
  }

  const rebatePaise =
    taxableIncomePaise <= constants.rebateTaxableIncomeLimitPaise
      ? Math.min(taxBeforeRebatePaise, constants.rebateLimitPaise)
      : 0;
  const taxAfterRebatePaise = Math.max(taxBeforeRebatePaise - rebatePaise, 0);

  return Math.round(taxAfterRebatePaise * (1 + constants.cessRate));
}

function getEmployeeName(employee: { firstName: string; middleName: string; surname: string }) {
  return [employee.firstName, employee.middleName, employee.surname]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");
}

export function resolveReportInstitutionId(input: {
  user: ReportUser;
  requestedInstitutionId?: string;
  userInstitutionId?: string;
}) {
  if (input.user.role === "admin") {
    if (!input.requestedInstitutionId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Institute selection is required",
      });
    }

    return input.requestedInstitutionId;
  }

  if (!input.userInstitutionId) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Institution account not found for this user",
    });
  }

  if (input.requestedInstitutionId && input.requestedInstitutionId !== input.userInstitutionId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "School users cannot view another institute's report",
    });
  }

  return input.userInstitutionId;
}

export function buildReportRows(input: {
  employees: EmployeeRecord[];
  profiles: PayrollProfileRecord[];
  versions: PayrollVersionRecord[];
  customFieldPeriods: PayrollCustomFieldPeriodRecord[];
  lineItems: PayrollLineItemRecord[];
  financialYearStart: number;
}) {
  const profileByEmployeeId = new Map(
    input.profiles.map((profile) => [profile.employeeId, profile]),
  );
  const versionsByProfileId = new Map<string, PayrollVersionRecord[]>();
  const lineItemsByVersionId = new Map<string, PayrollLineItemRecord[]>();

  for (const version of input.versions) {
    const current = versionsByProfileId.get(version.payrollProfileId) ?? [];
    current.push(version);
    versionsByProfileId.set(version.payrollProfileId, current);
  }

  for (const lineItem of input.lineItems) {
    const current = lineItemsByVersionId.get(lineItem.payrollVersionId) ?? [];
    current.push(lineItem);
    lineItemsByVersionId.set(lineItem.payrollVersionId, current);
  }

  return input.employees.map((employee) => {
    const profile = profileByEmployeeId.get(employee.id);
    const versions = profile ? (versionsByProfileId.get(profile.id) ?? []) : [];
    const totals = {
      earningsPaise: 0,
      deductionsPaise: 0,
      netPayPaise: 0,
    };
    let tdsDeductedTillNowPaise = 0;

    for (const month of getFinancialYearMonths(input.financialYearStart)) {
      const version = resolvePayrollVersionForMonth(versions, month.value);
      const versionLineItems = version ? (lineItemsByVersionId.get(version.id) ?? []) : [];
      const lineItems = version
        ? filterSavedLineItemsForCustomFieldPeriods({
            savedLineItems: versionLineItems,
            versionEffectiveMonth: version.effectiveMonth,
            month: month.value,
            periods: input.customFieldPeriods,
          })
        : [];
      const monthTotals = calculatePayrollTotals(lineItems);
      totals.earningsPaise += monthTotals.earningsPaise;
      totals.deductionsPaise += monthTotals.deductionsPaise;
      totals.netPayPaise += monthTotals.netPayPaise;
      tdsDeductedTillNowPaise += lineItems
        .filter(
          (item) =>
            item.section === "deductions" && item.fixedFieldKey === INCOME_TAX_DEDUCTION_KEY,
        )
        .reduce((total, item) => total + item.amountPaise, 0);
    }
    const totalTaxPaise = calculateNewRegimeTaxPaise(
      totals.earningsPaise,
      input.financialYearStart,
    );

    return {
      employeeId: employee.id,
      name: getEmployeeName(employee),
      grossSalaryPaise: totals.earningsPaise,
      deductionPaise: totals.deductionsPaise,
      netSalaryPaise: totals.netPayPaise,
      tdsDeductedTillNowPaise,
      totalTaxPaise,
      pendingTdsPaise: Math.max(totalTaxPaise - tdsDeductedTillNowPaise, 0),
    };
  });
}

export function buildReportsModule(options: ReportsModuleOptions = {}) {
  const db = options.db ?? createDb();

  async function getInstitutionForUser(userId: string) {
    return db
      .select({
        id: institutions.id,
        name: institutions.name,
      })
      .from(institutions)
      .where(eq(institutions.userId, userId))
      .get();
  }

  async function getInstitution(institutionId: string) {
    const institution = await db
      .select({
        id: institutions.id,
        name: institutions.name,
      })
      .from(institutions)
      .where(eq(institutions.id, institutionId))
      .get();

    if (!institution) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Institute not found",
      });
    }

    return institution;
  }

  async function getReport(input: ReportInput, user: ReportUser) {
    assertSupportedFinancialYear(input.financialYearStart);

    const userInstitution = user.role === "user" ? await getInstitutionForUser(user.id) : undefined;
    const institutionId = resolveReportInstitutionId({
      user,
      requestedInstitutionId: input.institutionId,
      userInstitutionId: userInstitution?.id,
    });
    const institution =
      userInstitution?.id === institutionId ? userInstitution : await getInstitution(institutionId);

    const employeeRows = await db
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
    const profileRows = await db
      .select({
        id: employeePayrollProfiles.id,
        employeeId: employeePayrollProfiles.employeeId,
      })
      .from(employeePayrollProfiles)
      .where(
        and(
          eq(employeePayrollProfiles.institutionId, institutionId),
          eq(employeePayrollProfiles.financialYearStart, input.financialYearStart),
        ),
      );
    const versionRows = await db
      .select({
        id: employeePayrollVersions.id,
        payrollProfileId: employeePayrollVersions.payrollProfileId,
        effectiveMonth: employeePayrollVersions.effectiveMonth,
      })
      .from(employeePayrollVersions)
      .innerJoin(
        employeePayrollProfiles,
        eq(employeePayrollProfiles.id, employeePayrollVersions.payrollProfileId),
      )
      .where(
        and(
          eq(employeePayrollProfiles.institutionId, institutionId),
          eq(employeePayrollProfiles.financialYearStart, input.financialYearStart),
        ),
      );
    const customFieldPeriodRows = await db
      .select({
        customFieldDefinitionId: payrollCustomFieldPeriods.customFieldDefinitionId,
        effectiveFromMonth: payrollCustomFieldPeriods.effectiveFromMonth,
        effectiveToMonth: payrollCustomFieldPeriods.effectiveToMonth,
      })
      .from(payrollCustomFieldPeriods)
      .innerJoin(
        payrollCustomFieldDefinitions,
        eq(payrollCustomFieldPeriods.customFieldDefinitionId, payrollCustomFieldDefinitions.id),
      )
      .where(eq(payrollCustomFieldDefinitions.institutionId, institutionId));
    const lineItemRows = await db
      .select({
        payrollVersionId: payrollLineItems.payrollVersionId,
        section: payrollLineItems.section,
        fixedFieldKey: payrollLineItems.fixedFieldKey,
        customFieldDefinitionId: payrollLineItems.customFieldDefinitionId,
        amountPaise: payrollLineItems.amountPaise,
      })
      .from(payrollLineItems)
      .innerJoin(
        employeePayrollVersions,
        eq(employeePayrollVersions.id, payrollLineItems.payrollVersionId),
      )
      .innerJoin(
        employeePayrollProfiles,
        eq(employeePayrollProfiles.id, employeePayrollVersions.payrollProfileId),
      )
      .where(
        and(
          eq(employeePayrollProfiles.institutionId, institutionId),
          eq(employeePayrollProfiles.financialYearStart, input.financialYearStart),
        ),
      );

    return {
      institution,
      financialYearStart: input.financialYearStart,
      rows: buildReportRows({
        employees: employeeRows,
        profiles: profileRows,
        versions: versionRows,
        customFieldPeriods: customFieldPeriodRows,
        lineItems: lineItemRows,
        financialYearStart: input.financialYearStart,
      }),
    };
  }

  return {
    getReport,
  };
}

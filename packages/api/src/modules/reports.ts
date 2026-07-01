import { createDb } from "@paybuddy/db";
import {
  employeePayrollProfiles,
  employees,
  institutions,
  payrollLineItems,
} from "@paybuddy/db/schema/index";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, inArray } from "drizzle-orm";

import type { ReportInput } from "../schemas/reports";
import { calculateAnnualTotals, calculatePayrollTotals } from "./payroll";

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
  payrollProfileId: string;
  section: "earnings" | "deductions";
  fixedFieldKey: string | null;
  amountPaise: number;
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
  const taxableIncomePaise = Math.max(
    annualGrossSalaryPaise - constants.standardDeductionPaise,
    0,
  );
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

  if (
    input.requestedInstitutionId &&
    input.requestedInstitutionId !== input.userInstitutionId
  ) {
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
  lineItems: PayrollLineItemRecord[];
  financialYearStart: number;
}) {
  const profileByEmployeeId = new Map(
    input.profiles.map((profile) => [profile.employeeId, profile]),
  );
  const lineItemsByProfileId = new Map<string, PayrollLineItemRecord[]>();

  for (const lineItem of input.lineItems) {
    const current = lineItemsByProfileId.get(lineItem.payrollProfileId) ?? [];
    current.push(lineItem);
    lineItemsByProfileId.set(lineItem.payrollProfileId, current);
  }

  return input.employees.map((employee) => {
    const profile = profileByEmployeeId.get(employee.id);
    const lineItems = profile
      ? (lineItemsByProfileId.get(profile.id) ?? [])
      : [];
    const totals = calculateAnnualTotals(calculatePayrollTotals(lineItems));
    const tdsDeductedTillNowPaise =
      lineItems
        .filter(
          (item) =>
            item.section === "deductions" &&
            item.fixedFieldKey === INCOME_TAX_DEDUCTION_KEY,
        )
        .reduce((total, item) => total + item.amountPaise, 0) * 12;
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

    const userInstitution =
      user.role === "user" ? await getInstitutionForUser(user.id) : undefined;
    const institutionId = resolveReportInstitutionId({
      user,
      requestedInstitutionId: input.institutionId,
      userInstitutionId: userInstitution?.id,
    });
    const institution =
      userInstitution?.id === institutionId
        ? userInstitution
        : await getInstitution(institutionId);

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
      .orderBy(
        asc(employees.seniorityRank),
        asc(employees.surname),
        asc(employees.firstName),
      );
    const profileRows = await db
      .select({
        id: employeePayrollProfiles.id,
        employeeId: employeePayrollProfiles.employeeId,
      })
      .from(employeePayrollProfiles)
      .where(
        and(
          eq(employeePayrollProfiles.institutionId, institutionId),
          eq(
            employeePayrollProfiles.financialYearStart,
            input.financialYearStart,
          ),
        ),
      );
    const profileIds = profileRows.map((profile) => profile.id);
    const lineItemRows =
      profileIds.length > 0
        ? await db
            .select({
              payrollProfileId: payrollLineItems.payrollProfileId,
              section: payrollLineItems.section,
              fixedFieldKey: payrollLineItems.fixedFieldKey,
              amountPaise: payrollLineItems.amountPaise,
            })
            .from(payrollLineItems)
            .where(inArray(payrollLineItems.payrollProfileId, profileIds))
        : [];

    return {
      institution,
      financialYearStart: input.financialYearStart,
      rows: buildReportRows({
        employees: employeeRows,
        profiles: profileRows,
        lineItems: lineItemRows,
        financialYearStart: input.financialYearStart,
      }),
    };
  }

  return {
    getReport,
  };
}

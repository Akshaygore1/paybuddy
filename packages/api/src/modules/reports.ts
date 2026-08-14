import { createDb } from "@tds-nivaran/db";
import { institutions } from "@tds-nivaran/db/schema/index";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";

import type { ReportInput } from "../schemas/reports";
import { buildPayrollHistoryModule } from "./payroll-history";

type Db = ReturnType<typeof createDb>;

type ReportsModuleOptions = {
  db?: Db;
};

type ReportUser = {
  id: string;
  role: "admin" | "user";
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
  employees: Array<{
    employee: { id: string; name: string };
    annualTotals: { earningsPaise: number; deductionsPaise: number; netPayPaise: number };
    monthlyPayroll: Array<{
      lineItems: Array<{
        section: "earnings" | "deductions";
        fixedFieldKey: string | null;
        amountPaise: number;
      }>;
    }>;
  }>;
  financialYearStart: number;
}) {
  return input.employees.map((employee) => {
    const tdsDeductedTillNowPaise = employee.monthlyPayroll.reduce(
      (annualTotal, payroll) =>
        annualTotal +
        payroll.lineItems
          .filter(
            (item) =>
              item.section === "deductions" && item.fixedFieldKey === INCOME_TAX_DEDUCTION_KEY,
          )
          .reduce((total, item) => total + item.amountPaise, 0),
      0,
    );
    const totalTaxPaise = calculateNewRegimeTaxPaise(
      employee.annualTotals.earningsPaise,
      input.financialYearStart,
    );

    return {
      employeeId: employee.employee.id,
      name: employee.employee.name,
      grossSalaryPaise: employee.annualTotals.earningsPaise,
      deductionPaise: employee.annualTotals.deductionsPaise,
      netSalaryPaise: employee.annualTotals.netPayPaise,
      tdsDeductedTillNowPaise,
      totalTaxPaise,
      pendingTdsPaise: Math.max(totalTaxPaise - tdsDeductedTillNowPaise, 0),
    };
  });
}

export function buildReportsModule(options: ReportsModuleOptions = {}) {
  const db = options.db ?? createDb();
  const payrollHistory = buildPayrollHistoryModule({ db });

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

  async function getReport(input: ReportInput, user: ReportUser) {
    assertSupportedFinancialYear(input.financialYearStart);

    const userInstitution = user.role === "user" ? await getInstitutionForUser(user.id) : undefined;
    const institutionId = resolveReportInstitutionId({
      user,
      requestedInstitutionId: input.institutionId,
      userInstitutionId: userInstitution?.id,
    });
    const history = await payrollHistory.getInstitutionFinancialYear(
      institutionId,
      input.financialYearStart,
    );

    return {
      institution: history.institution,
      financialYearStart: input.financialYearStart,
      rows: buildReportRows({
        employees: history.employees,
        financialYearStart: input.financialYearStart,
      }),
    };
  }

  return {
    getReport,
  };
}

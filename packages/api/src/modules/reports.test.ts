import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";

import { buildReportRows, calculateNewRegimeTaxPaise, resolveReportInstitutionId } from "./reports";

describe("Reports tax helper", () => {
  it("returns zero tax for zero salary", () => {
    expect(calculateNewRegimeTaxPaise(0, 2026)).toBe(0);
  });

  it("applies the new-regime rebate below the rebate limit", () => {
    expect(calculateNewRegimeTaxPaise(10_00_000 * 100, 2026)).toBe(0);
  });

  it("handles slab boundaries after standard deduction", () => {
    expect(calculateNewRegimeTaxPaise(4_75_000 * 100, 2026)).toBe(0);
    expect(calculateNewRegimeTaxPaise(16_75_000 * 100, 2026)).toBe(1_24_800 * 100);
  });

  it("calculates tax for high salary with cess", () => {
    expect(calculateNewRegimeTaxPaise(30_75_000 * 100, 2026)).toBe(4_80_000 * 1.04 * 100);
  });
});

describe("Reports access scope", () => {
  it("requires admins to select an institute", () => {
    expect(() =>
      resolveReportInstitutionId({
        user: { id: "admin-1", role: "admin" },
      }),
    ).toThrow(TRPCError);
  });

  it("allows admins to select an institute", () => {
    expect(
      resolveReportInstitutionId({
        user: { id: "admin-1", role: "admin" },
        requestedInstitutionId: "institution-1",
      }),
    ).toBe("institution-1");
  });

  it("resolves school users to their own institute", () => {
    expect(
      resolveReportInstitutionId({
        user: { id: "user-1", role: "user" },
        userInstitutionId: "institution-1",
      }),
    ).toBe("institution-1");
  });

  it("rejects school users requesting another institute", () => {
    expect(() =>
      resolveReportInstitutionId({
        user: { id: "user-1", role: "user" },
        requestedInstitutionId: "institution-2",
        userInstitutionId: "institution-1",
      }),
    ).toThrow("School users cannot view another institute's report");
  });
});

describe("Reports row aggregation", () => {
  it("includes employees without saved payroll rows with zero totals", () => {
    const rows = buildReportRows({
      financialYearStart: 2026,
      employees: [
        {
          id: "employee-1",
          firstName: "Asha",
          middleName: "",
          surname: "Patel",
          seniorityRank: 1,
        },
      ],
      profiles: [],
      versions: [],
      customFieldPeriods: [],
      lineItems: [],
    });

    expect(rows).toEqual([
      {
        employeeId: "employee-1",
        name: "Asha Patel",
        grossSalaryPaise: 0,
        deductionPaise: 0,
        netSalaryPaise: 0,
        tdsDeductedTillNowPaise: 0,
        totalTaxPaise: 0,
        pendingTdsPaise: 0,
      },
    ]);
  });

  it("sums effective monthly payroll versions and preserves later changes", () => {
    const rows = buildReportRows({
      financialYearStart: 2026,
      employees: [
        {
          id: "employee-1",
          firstName: "Asha",
          middleName: "R",
          surname: "Patel",
          seniorityRank: 1,
        },
      ],
      profiles: [{ id: "profile-1", employeeId: "employee-1" }],
      versions: [
        {
          id: "version-april",
          payrollProfileId: "profile-1",
          effectiveMonth: "2026-04",
        },
        {
          id: "version-june",
          payrollProfileId: "profile-1",
          effectiveMonth: "2026-06",
        },
      ],
      customFieldPeriods: [
        {
          customFieldDefinitionId: "allowance",
          effectiveFromMonth: "2026-04",
          effectiveToMonth: "2026-09",
        },
      ],
      lineItems: [
        {
          payrollVersionId: "version-april",
          section: "earnings",
          fixedFieldKey: "basicPay",
          customFieldDefinitionId: null,
          amountPaise: 1_00_000 * 100,
        },
        {
          payrollVersionId: "version-april",
          section: "deductions",
          fixedFieldKey: "incomeTax",
          customFieldDefinitionId: null,
          amountPaise: 5_000 * 100,
        },
        {
          payrollVersionId: "version-april",
          section: "earnings",
          fixedFieldKey: null,
          customFieldDefinitionId: "allowance",
          amountPaise: 10_000 * 100,
        },
        {
          payrollVersionId: "version-june",
          section: "earnings",
          fixedFieldKey: "basicPay",
          customFieldDefinitionId: null,
          amountPaise: 1_20_000 * 100,
        },
        {
          payrollVersionId: "version-june",
          section: "deductions",
          fixedFieldKey: "incomeTax",
          customFieldDefinitionId: null,
          amountPaise: 6_000 * 100,
        },
        {
          payrollVersionId: "version-june",
          section: "earnings",
          fixedFieldKey: null,
          customFieldDefinitionId: "allowance",
          amountPaise: 10_000 * 100,
        },
      ],
    });

    expect(rows[0]).toMatchObject({
      name: "Asha R Patel",
      grossSalaryPaise: 14_50_000 * 100,
      deductionPaise: 70_000 * 100,
      netSalaryPaise: 13_80_000 * 100,
      tdsDeductedTillNowPaise: 70_000 * 100,
    });
  });
});

import { TRPCError } from "@trpc/server";
import { payrollLineItems } from "@tds-nivaran/db/schema/index";
import * as schema from "@tds-nivaran/db/schema/index";
import { drizzle } from "drizzle-orm/d1";
import { describe, expect, it } from "vitest";

import { chunkForD1, PAYROLL_LINE_ITEM_BOUND_PARAMETERS } from "@tds-nivaran/db/d1";
import { payrollEmployeeFormSchema } from "../schemas/payroll";

import {
  assertNoDuplicateActivePayrollLabel,
  buildPayrollModule,
  calculatePayrollTotals,
  fixedPayrollFields,
  formatPaiseAsMoney,
  filterSavedLineItemsForCustomFieldPeriods,
  getFinancialYearMonths,
  getInitialPayrollEffectiveMonths,
  parseMoneyToPaise,
  resolvePayrollVersionForMonth,
} from "./payroll";
import { createSqliteD1 } from "./d1-test-utils";

describe("Payroll D1 statement limits", () => {
  function getInsertParameterCounts(rowCount: number) {
    const db = drizzle({} as D1Database);
    const rows = Array.from({ length: rowCount }, (_, index) => ({
      id: `line-item-${index}`,
      payrollVersionId: "version-1",
      section: "earnings" as const,
      fixedFieldKey: `field-${index}`,
      customFieldDefinitionId: null,
      label: `Field ${index}`,
      amountPaise: index,
      sortOrder: index,
    }));

    return chunkForD1(rows, PAYROLL_LINE_ITEM_BOUND_PARAMETERS).map(
      (chunk) => db.insert(payrollLineItems).values(chunk).toSQL().params.length,
    );
  }

  it("keeps 12 payroll rows in one statement at the D1 boundary", () => {
    expect(getInsertParameterCounts(12)).toEqual([96]);
  });

  it("splits the standard 13 payroll fields into D1-safe statements", () => {
    const parameterCounts = getInsertParameterCounts(13);

    expect(parameterCounts).toEqual([96, 8]);
    expect(Math.max(...parameterCounts)).toBeLessThanOrEqual(100);
  });

  it("rolls back version line-item replacement when a later batch statement fails", async () => {
    const sqlite = await createSqliteD1({ failBatchAt: 2 });
    await sqlite.executeMultiple(`
      create table employees (
        id text primary key, institution_id text not null, first_name text not null,
        middle_name text not null, surname text not null
      );
      create table payroll_custom_field_definitions (
        id text primary key, institution_id text not null, section text not null,
        label text not null, key text not null, is_active integer not null,
        sort_order integer not null
      );
      create table payroll_custom_field_periods (
        id text primary key, custom_field_definition_id text not null,
        effective_from_month text not null, effective_to_month text
      );
      create table employee_payroll_profiles (
        id text primary key, institution_id text not null, employee_id text not null,
        financial_year_start integer not null
      );
      create table employee_payroll_versions (
        id text primary key, payroll_profile_id text not null, effective_month text not null
      );
      create table payroll_line_items (
        id text primary key, payroll_version_id text not null, section text not null,
        fixed_field_key text, custom_field_definition_id text, label text not null,
        amount_paise integer not null, sort_order integer not null,
        created_at integer default 0 not null, updated_at integer default 0 not null
      );
      insert into employees values ('employee-1', 'institution-1', 'Asha', '', 'Patel');
      insert into employee_payroll_profiles values ('profile-1', 'institution-1', 'employee-1', 2026);
      insert into employee_payroll_versions values ('version-1', 'profile-1', '2026-04');
      insert into payroll_line_items values (
        'old-item', 'version-1', 'earnings', 'basicPay', null, 'Basic Pay', 50000, 1, 0, 0
      );
    `);
    const db = drizzle(sqlite.client, { schema });
    const payroll = buildPayrollModule({ db: db as never });
    const lineItems = Object.entries(fixedPayrollFields).flatMap(([section, fields]) =>
      fields.map((field) => ({
        section: section as "earnings" | "deductions",
        fixedFieldKey: field.key,
        customFieldDefinitionId: null,
        amount: "100.00",
      })),
    );

    await expect(
      payroll.save("institution-1", {
        employeeId: "employee-1",
        financialYearStart: 2026,
        month: "2026-04",
        lineItems,
      }),
    ).rejects.toThrow("__forced_batch_failure");

    const versions = await sqlite.execute("select id from employee_payroll_versions");
    const lineItemsAfterFailure = await sqlite.execute(
      "select id, amount_paise from payroll_line_items",
    );

    expect(versions.rows).toEqual([{ id: "version-1" }]);
    expect(lineItemsAfterFailure.rows).toEqual([{ id: "old-item", amount_paise: 50_000 }]);
    sqlite.close();
  });
});

describe("Payroll money helpers", () => {
  it("parses and formats paise without floating point drift", () => {
    expect(parseMoneyToPaise("1234.50")).toBe(123_450);
    expect(parseMoneyToPaise("10.5")).toBe(1_050);
    expect(formatPaiseAsMoney(123_450)).toBe("1234.50");
  });

  it("rejects invalid or negative money input", () => {
    expect(() => parseMoneyToPaise("-1")).toThrow(TRPCError);
    expect(() => parseMoneyToPaise("1.999")).toThrow(TRPCError);
    expect(() => parseMoneyToPaise("abc")).toThrow(TRPCError);
  });
});

describe("Payroll financial year helpers", () => {
  it("generates April through March for a financial year", () => {
    const months = getFinancialYearMonths(2026);

    expect(months).toHaveLength(12);
    expect(months[0]).toMatchObject({
      value: "2026-04",
      monthIndex: 3,
      year: 2026,
    });
    expect(months[11]).toMatchObject({
      value: "2027-03",
      monthIndex: 2,
      year: 2027,
    });
  });

  it("resolves the latest payroll version without crossing later changes", () => {
    const versions = [
      { id: "april", effectiveMonth: "2026-04" },
      { id: "june", effectiveMonth: "2026-06" },
      { id: "september", effectiveMonth: "2026-09" },
    ];

    expect(resolvePayrollVersionForMonth(versions, "2026-05")?.id).toBe("april");
    expect(resolvePayrollVersionForMonth(versions, "2026-08")?.id).toBe("june");
    expect(resolvePayrollVersionForMonth(versions, "2026-09")?.id).toBe("september");
    expect(resolvePayrollVersionForMonth(versions, "2026-03")).toBeNull();
  });

  it("rejects a payroll month outside the selected financial year", () => {
    expect(
      payrollEmployeeFormSchema.safeParse({
        employeeId: "employee-1",
        financialYearStart: 2026,
        month: "2027-04",
      }).success,
    ).toBe(false);
    expect(
      payrollEmployeeFormSchema.safeParse({
        employeeId: "employee-1",
        financialYearStart: 2026,
        month: "2027-03",
      }).success,
    ).toBe(true);
  });

  it("backfills a first save to April without backdating newer custom fields", () => {
    expect(
      getInitialPayrollEffectiveMonths({
        financialYearStart: 2026,
        selectedMonth: "2026-09",
        activeCustomFieldIds: ["june-field", "september-field"],
        periods: [
          {
            customFieldDefinitionId: "june-field",
            effectiveFromMonth: "2026-06",
            effectiveToMonth: null,
          },
          {
            customFieldDefinitionId: "september-field",
            effectiveFromMonth: "2026-09",
            effectiveToMonth: null,
          },
        ],
      }),
    ).toEqual(["2026-04", "2026-06", "2026-09"]);
  });
});

describe("Payroll field ordering and totals", () => {
  it("keeps fixed earning and deduction field order", () => {
    expect(fixedPayrollFields.earnings.map((field) => field.label)).toEqual([
      "Basic Pay",
      "D.A.",
      "D.A. Difference Arrears",
      "HRA",
      "C.L.A",
      "V.A/T.A. Arrear",
    ]);
    expect(fixedPayrollFields.deductions.map((field) => field.label)).toEqual([
      "Recovery",
      "G.P.F",
      "R.D",
      "C.M. Fund",
      "Income Tax / TDS",
      "Professional Tax",
      "L.I.C",
    ]);
  });

  it("calculates monthly totals from paise", () => {
    const monthlyTotals = calculatePayrollTotals([
      { section: "earnings", amountPaise: 100_25 },
      { section: "earnings", amountPaise: 200_25 },
      { section: "deductions", amountPaise: 50_10 },
    ]);

    expect(monthlyTotals).toEqual({
      earningsPaise: 300_50,
      deductionsPaise: 50_10,
      netPayPaise: 250_40,
    });
  });
});

describe("Payroll custom field validation", () => {
  it("does not restore an employee's old amount when a field is reactivated", () => {
    const savedLineItems = [
      {
        id: "old-value",
        section: "earnings" as const,
        fixedFieldKey: null,
        customFieldDefinitionId: "allowance",
        label: "Allowance",
        amountPaise: 5_000,
        sortOrder: 1001,
      },
    ];

    expect(
      filterSavedLineItemsForCustomFieldPeriods({
        savedLineItems,
        versionEffectiveMonth: "2026-04",
        month: "2026-12",
        periods: [
          {
            customFieldDefinitionId: "allowance",
            effectiveFromMonth: "2026-04",
            effectiveToMonth: "2026-09",
          },
          {
            customFieldDefinitionId: "allowance",
            effectiveFromMonth: "2026-12",
            effectiveToMonth: null,
          },
        ],
      }),
    ).toEqual([]);
  });

  it("rejects duplicate active labels in the same section", () => {
    expect(() =>
      assertNoDuplicateActivePayrollLabel(
        [
          { label: "Special Allowance", section: "earnings", isActive: true },
          { label: "Special Allowance", section: "deductions", isActive: true },
        ],
        "earnings",
        " special allowance ",
      ),
    ).toThrow("A payroll field with this label already exists in this section");
  });

  it("allows matching labels in different sections or archived fields", () => {
    expect(() =>
      assertNoDuplicateActivePayrollLabel(
        [
          { label: "Special Allowance", section: "deductions", isActive: true },
          { label: "Old Allowance", section: "earnings", isActive: false },
        ],
        "earnings",
        "Special Allowance",
      ),
    ).not.toThrow();
  });
});

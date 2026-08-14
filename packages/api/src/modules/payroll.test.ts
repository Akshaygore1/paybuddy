import { TRPCError } from "@trpc/server";
import { payrollLineItems } from "@tds-nivaran/db/schema/index";
import * as schema from "@tds-nivaran/db/schema/index";
import { drizzle } from "drizzle-orm/d1";
import { describe, expect, it } from "vitest";

import { planD1Statements } from "@tds-nivaran/db/d1";
import { payrollEmployeeFormSchema } from "../schemas/payroll";

import {
  buildPayrollModule,
  calculatePayrollTotals,
  fixedPayrollFields,
  formatPaiseAsMoney,
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

    return planD1Statements(rows, (chunk) => db.insert(payrollLineItems).values(chunk)).map(
      (statement) => statement.toSQL().params.length,
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

  it("rolls back a selected version replacement without touching later versions", async () => {
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
      insert into employee_payroll_versions values ('version-2', 'profile-1', '2026-09');
      insert into payroll_line_items values (
        'old-item', 'version-1', 'earnings', 'basicPay', null, 'Basic Pay', 50000, 1, 0, 0
      );
      insert into payroll_line_items values (
        'future-item', 'version-2', 'earnings', 'basicPay', null, 'Basic Pay', 200000, 1, 0, 0
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

    expect(versions.rows).toEqual([{ id: "version-1" }, { id: "version-2" }]);
    expect(lineItemsAfterFailure.rows).toEqual([
      { id: "old-item", amount_paise: 50_000 },
      { id: "future-item", amount_paise: 200_000 },
    ]);
    sqlite.close();
  });

  it("preserves later version changes when an earlier month is saved", async () => {
    const sqlite = await createSqliteD1();
    await sqlite.executeMultiple(`
      create table institutions (
        id text primary key, name text not null, tan_number text not null, address text not null
      );
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
        financial_year_start integer not null,
        created_at integer default 0 not null, updated_at integer default 0 not null
      );
      create table employee_payroll_versions (
        id text primary key, payroll_profile_id text not null, effective_month text not null,
        created_at integer default 0 not null, updated_at integer default 0 not null
      );
      create table payroll_line_items (
        id text primary key, payroll_version_id text not null, section text not null,
        fixed_field_key text, custom_field_definition_id text, label text not null,
        amount_paise integer not null, sort_order integer not null,
        created_at integer default 0 not null, updated_at integer default 0 not null
      );
      insert into institutions values ('institution-1', 'School', 'TAN1', 'Address');
      insert into employees values ('employee-1', 'institution-1', 'Asha', '', 'Patel');
      insert into employees values ('employee-2', 'institution-1', 'Ravi', '', 'Shah');
      insert into payroll_custom_field_definitions values
        ('allowance', 'institution-1', 'earnings', 'Allowance', 'allowance', 1, 1),
        ('later-field', 'institution-1', 'earnings', 'Later Field', 'later_field', 1, 2);
      insert into payroll_custom_field_periods values
        ('allowance-period', 'allowance', '2026-06', null),
        ('later-period', 'later-field', '2026-09', null);
      insert into employee_payroll_profiles values
        ('profile-1', 'institution-1', 'employee-1', 2026, 0, 0),
        ('profile-other-employee', 'institution-1', 'employee-2', 2026, 0, 0),
        ('profile-other-fy', 'institution-1', 'employee-1', 2025, 0, 0);
      insert into employee_payroll_versions values
        ('version-april', 'profile-1', '2026-04', 0, 0),
        ('version-september', 'profile-1', '2026-09', 0, 0),
        ('version-october', 'profile-1', '2026-10', 0, 0),
        ('version-march', 'profile-1', '2027-03', 0, 0),
        ('version-other-employee', 'profile-other-employee', '2026-09', 0, 0),
        ('version-other-fy', 'profile-other-fy', '2025-09', 0, 0);
      insert into payroll_line_items values
        ('item-april', 'version-april', 'earnings', 'basicPay', null, 'Basic Pay', 50000, 1, 0, 0),
        ('item-september', 'version-september', 'earnings', 'basicPay', null, 'Basic Pay', 20000000, 1, 0, 0),
        ('item-september-custom', 'version-september', 'earnings', null, 'allowance', 'Allowance', 90000, 1001, 0, 0),
        ('item-october', 'version-october', 'earnings', 'basicPay', null, 'Basic Pay', 30000000, 1, 0, 0),
        ('item-march', 'version-march', 'earnings', 'basicPay', null, 'Basic Pay', 40000000, 1, 0, 0),
        ('item-other-employee', 'version-other-employee', 'earnings', 'basicPay', null, 'Basic Pay', 70000, 1, 0, 0),
        ('item-other-fy', 'version-other-fy', 'earnings', 'basicPay', null, 'Basic Pay', 80000, 1, 0, 0);
    `);
    const db = drizzle(sqlite.client, { schema });
    const payroll = buildPayrollModule({ db: db as never });

    const augustForm = await payroll.save("institution-1", {
      employeeId: "employee-1",
      financialYearStart: 2026,
      month: "2026-08",
      lineItems: [
        {
          section: "earnings",
          fixedFieldKey: "basicPay",
          customFieldDefinitionId: null,
          amount: "100000.00",
        },
        {
          section: "earnings",
          fixedFieldKey: null,
          customFieldDefinitionId: "allowance",
          amount: "700.00",
        },
      ],
    });

    expect(augustForm.effectiveMonth).toBe("2026-08");
    expect(
      augustForm.monthlyPayroll
        .find((item) => item.month === "2026-09")
        ?.lineItems.find((item) => item.fixedFieldKey === "basicPay")?.amountPaise,
    ).toBe(20_000_000);
    expect(
      augustForm.monthlyPayroll
        .find((item) => item.month === "2026-10")
        ?.lineItems.find((item) => item.fixedFieldKey === "basicPay")?.amountPaise,
    ).toBe(30_000_000);
    expect(
      augustForm.monthlyPayroll
        .find((item) => item.month === "2027-03")
        ?.lineItems.find((item) => item.fixedFieldKey === "basicPay")?.amountPaise,
    ).toBe(40_000_000);
    expect(
      augustForm.monthlyPayroll
        .find((item) => item.month === "2026-09")
        ?.lineItems.find((item) => item.customFieldDefinitionId === "later-field")?.amountPaise,
    ).toBe(0);

    const remainingVersions = await sqlite.execute(
      "select id, payroll_profile_id from employee_payroll_versions order by id",
    );
    expect(remainingVersions.rows).toHaveLength(7);
    expect(remainingVersions.rows).toEqual(
      expect.arrayContaining([
        { id: "version-april", payroll_profile_id: "profile-1" },
        { id: "version-other-employee", payroll_profile_id: "profile-other-employee" },
        { id: "version-other-fy", payroll_profile_id: "profile-other-fy" },
        expect.objectContaining({ payroll_profile_id: "profile-1" }),
      ]),
    );
    const untouchedLineItems = await sqlite.execute(
      "select id, amount_paise from payroll_line_items where id in ('item-other-employee', 'item-other-fy') order by id",
    );
    expect(untouchedLineItems.rows).toEqual([
      { id: "item-other-employee", amount_paise: 70_000 },
      { id: "item-other-fy", amount_paise: 80_000 },
    ]);

    const septemberForm = await payroll.save("institution-1", {
      employeeId: "employee-1",
      financialYearStart: 2026,
      month: "2026-09",
      lineItems: [
        {
          section: "earnings",
          fixedFieldKey: "basicPay",
          customFieldDefinitionId: null,
          amount: "0",
        },
        {
          section: "earnings",
          fixedFieldKey: null,
          customFieldDefinitionId: "allowance",
          amount: "0",
        },
        {
          section: "earnings",
          fixedFieldKey: null,
          customFieldDefinitionId: "later-field",
          amount: "0",
        },
      ],
    });
    const octoberPayroll = septemberForm.monthlyPayroll.find((item) => item.month === "2026-10");

    expect(octoberPayroll?.effectiveMonth).toBe("2026-10");
    expect(
      octoberPayroll?.lineItems.find((item) => item.fixedFieldKey === "basicPay")?.amountPaise,
    ).toBe(30_000_000);
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
        activeCustomFieldPeriods: [
          {
            customFieldDefinitionId: "june-field",
            effectiveFromMonth: "2026-06",
          },
          {
            customFieldDefinitionId: "september-field",
            effectiveFromMonth: "2026-09",
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

import * as schema from "@tds-nivaran/db/schema/index";
import { drizzle } from "drizzle-orm/d1";
import { afterEach, describe, expect, it } from "vitest";

import { createSqliteD1 } from "./d1-test-utils";
import { buildEmployeeRecordsModule } from "./employee-records";
import { buildPayrollModule } from "./payroll";
import { buildReportsModule } from "./reports";

describe("D1 high-cardinality institution reads", () => {
  const openDatabases: Array<{ close: () => void }> = [];

  afterEach(() => {
    for (const database of openDatabases.splice(0)) {
      database.close();
    }
  });

  it("loads reports, payroll periods, and Employee values above 100 related records", async () => {
    const recordCount = 101;
    const sqlite = await createSqliteD1();
    openDatabases.push(sqlite);
    await sqlite.executeMultiple(`
      create table institutions (
        id text primary key, name text not null, user_id text, tan_number text not null,
        address text not null
      );
      create table employee_designations (
        id text primary key, institution_id text not null, name text not null,
        is_active integer not null, sort_order integer not null,
        created_at integer default 0 not null, updated_at integer default 0 not null
      );
      create table employee_custom_field_definitions (
        id text primary key, institution_id text not null, label text not null, key text not null,
        is_required integer not null, is_active integer not null, sort_order integer not null,
        created_at integer default 0 not null, updated_at integer default 0 not null
      );
      create table employees (
        id text primary key, institution_id text not null, first_name text not null,
        middle_name text not null, surname text not null, date_of_birth text not null,
        gender text not null, designation_id text not null, seniority_rank integer not null,
        pan_number text, pf_number text, nps_account_number text, whats_app_number text,
        contact_number text, created_at integer default 0 not null,
        updated_at integer default 0 not null
      );
      create table employee_custom_field_values (
        id text primary key, employee_id text not null, field_definition_id text not null,
        value text not null, created_at integer default 0 not null,
        updated_at integer default 0 not null
      );
      create table payroll_custom_field_definitions (
        id text primary key, institution_id text not null, section text not null,
        label text not null, key text not null, is_active integer not null,
        sort_order integer not null, created_at integer default 0 not null,
        updated_at integer default 0 not null
      );
      create table payroll_custom_field_periods (
        id text primary key, custom_field_definition_id text not null,
        effective_from_month text not null, effective_to_month text,
        created_at integer default 0 not null, updated_at integer default 0 not null
      );
      create table employee_payroll_profiles (
        id text primary key, institution_id text not null, employee_id text not null,
        financial_year_start integer not null, created_at integer default 0 not null,
        updated_at integer default 0 not null
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
      insert into institutions values (
        'institution-1', 'High Cardinality School', null, 'TAN123', 'Test address'
      );
      insert into employee_designations values (
        'designation-1', 'institution-1', 'Teacher', 1, 1, 0, 0
      );
    `);

    const seedStatements = Array.from({ length: recordCount }, (_, index) => [
      {
        sql: `insert into employee_custom_field_definitions
          (id, institution_id, label, key, is_required, is_active, sort_order)
          values (?, 'institution-1', ?, ?, 0, 1, ?)`,
        args: [
          `employee-field-${index}`,
          `Employee Field ${index}`,
          `employee_field_${index}`,
          index,
        ],
      },
      {
        sql: `insert into employees
          (id, institution_id, first_name, middle_name, surname, date_of_birth, gender,
           designation_id, seniority_rank)
          values (?, 'institution-1', ?, '', 'Patel', '1990-01-01', 'Female', 'designation-1', ?)`,
        args: [`employee-${index}`, `Employee ${index}`, index + 1],
      },
      {
        sql: `insert into employee_custom_field_values
          (id, employee_id, field_definition_id, value) values (?, ?, ?, ?)`,
        args: [
          `employee-value-${index}`,
          `employee-${index}`,
          `employee-field-${index}`,
          `Value ${index}`,
        ],
      },
      {
        sql: `insert into payroll_custom_field_definitions
          (id, institution_id, section, label, key, is_active, sort_order)
          values (?, 'institution-1', 'earnings', ?, ?, 1, ?)`,
        args: [`payroll-field-${index}`, `Payroll Field ${index}`, `payroll_field_${index}`, index],
      },
      {
        sql: `insert into payroll_custom_field_periods
          (id, custom_field_definition_id, effective_from_month) values (?, ?, '2026-04')`,
        args: [`period-${index}`, `payroll-field-${index}`],
      },
      {
        sql: `insert into employee_payroll_profiles
          (id, institution_id, employee_id, financial_year_start)
          values (?, 'institution-1', ?, 2026)`,
        args: [`profile-${index}`, `employee-${index}`],
      },
      {
        sql: `insert into employee_payroll_versions
          (id, payroll_profile_id, effective_month) values (?, ?, '2026-04')`,
        args: [`version-${index}`, `profile-${index}`],
      },
      {
        sql: `insert into payroll_line_items
          (id, payroll_version_id, section, fixed_field_key, label, amount_paise, sort_order)
          values (?, ?, 'earnings', 'basicPay', 'Basic Pay', 100, 1)`,
        args: [`line-item-${index}`, `version-${index}`],
      },
    ]).flat();
    await sqlite.batch(seedStatements, "write");

    const db = drizzle(sqlite.client, { schema });
    const employeeRecords = buildEmployeeRecordsModule({ db: db as never });
    const reports = buildReportsModule({ db: db as never });
    const payroll = buildPayrollModule({ db: db as never });

    const directory = await employeeRecords.getDirectory("institution-1");
    const report = await reports.getReport(
      { institutionId: "institution-1", financialYearStart: 2026 },
      { id: "admin-1", role: "admin" },
    );
    const newPayrollField = await payroll.addCustomField("institution-1", {
      financialYearStart: 2026,
      month: "2026-04",
      section: "earnings",
      label: "New Allowance",
    });

    expect(directory.rows).toHaveLength(recordCount);
    expect(directory.rows[100]?.values["customField:employee-field-100"]).toBe("Value 100");
    expect(report.rows).toHaveLength(recordCount);
    expect(report.rows[100]?.grossSalaryPaise).toBe(1_200);
    expect(newPayrollField).toMatchObject({ label: "New Allowance", sortOrder: 101 });
  });
});

import { TRPCError } from "@trpc/server";
import { planD1Statements } from "@tds-nivaran/db/d1";
import { employeeCustomFieldValues } from "@tds-nivaran/db/schema/index";
import * as schema from "@tds-nivaran/db/schema/index";
import { drizzle } from "drizzle-orm/d1";
import { describe, expect, it } from "vitest";

import { buildEmployeeRecordsModule, validateSubmittedCustomFields } from "./employee-records";
import { createRecordingD1, createSqliteD1 } from "./d1-test-utils";

describe("Employee Custom Field D1 statement limits", () => {
  const recordCount = 26;

  function getCustomFieldDefinitions() {
    return Array.from({ length: recordCount }, (_, index) => [
      `field-${index}`,
      `Field ${index}`,
      `field_${index}`,
      1,
      index,
    ]);
  }

  function getEmployeeInput() {
    return {
      firstName: "Asha",
      middleName: "R",
      surname: "Patel",
      dateOfBirth: "1990-01-01",
      gender: "Female" as const,
      designationId: "designation-1",
      seniorityRank: 1,
      panNumber: "",
      pfNumber: "",
      npsAccountNumber: "",
      whatsAppNumber: "",
      contactNumber: "",
      customFieldValues: Object.fromEntries(
        Array.from({ length: recordCount }, (_, index) => [`field-${index}`, `Value ${index}`]),
      ),
    };
  }

  function getReturnedEmployeeRow() {
    return [
      "employee-1",
      "institution-1",
      "Asha",
      "R",
      "Patel",
      "1990-01-01",
      "Female",
      "designation-1",
      1,
      null,
      null,
      null,
      null,
      null,
      1_700_000_000_000,
      1_700_000_000_000,
    ];
  }

  function getAtomicWriteDatabaseSql(withEmployee: boolean) {
    const definitions = Array.from(
      { length: recordCount },
      (_, index) =>
        `('field-${index}', 'institution-1', 'Field ${index}', 'field_${index}', 1, 1, ${index}, 0, 0)`,
    ).join(",");
    const oldValues = Array.from(
      { length: recordCount },
      (_, index) => `('old-value-${index}', 'employee-1', 'field-${index}', 'Old ${index}', 0, 0)`,
    ).join(",");

    return `
      create table employee_designations (
        id text primary key, institution_id text not null, name text not null,
        is_active integer not null, sort_order integer not null,
        created_at integer default 0 not null, updated_at integer default 0 not null
      );
      create table employees (
        id text primary key, institution_id text not null, first_name text not null,
        middle_name text not null, surname text not null, date_of_birth text not null,
        gender text not null, designation_id text not null, seniority_rank integer not null,
        pan_number text, pf_number text, nps_account_number text, whatsapp_number text,
        contact_number text, created_at integer default 0 not null, updated_at integer default 0 not null
      );
      create table employee_custom_field_definitions (
        id text primary key, institution_id text not null, label text not null, key text not null,
        is_required integer not null, is_active integer not null, sort_order integer not null,
        created_at integer default 0 not null, updated_at integer default 0 not null
      );
      create table employee_custom_field_values (
        id text primary key, employee_id text not null, field_definition_id text not null,
        value text not null, created_at integer default 0 not null, updated_at integer default 0 not null
      );
      insert into employee_designations values
        ('designation-1', 'institution-1', 'Teacher', 1, 1, 0, 0);
      insert into employee_custom_field_definitions values ${definitions};
      ${
        withEmployee
          ? `insert into employees values ('employee-1', 'institution-1', 'Old', '', 'Employee', '1990-01-01', 'Female', 'designation-1', 1, null, null, null, null, null, 0, 0);
             insert into employee_custom_field_values values ${oldValues};`
          : ""
      }
    `;
  }

  function getInsertParameterCounts(rowCount: number) {
    const db = drizzle({} as D1Database);
    const rows = Array.from({ length: rowCount }, (_, index) => ({
      id: `value-${index}`,
      employeeId: "employee-1",
      fieldDefinitionId: `field-${index}`,
      value: `Value ${index}`,
    }));

    return planD1Statements(rows, (chunk) =>
      db.insert(employeeCustomFieldValues).values(chunk),
    ).map((statement) => statement.toSQL().params.length);
  }

  it("keeps 25 Custom Field values in one statement at the D1 boundary", () => {
    expect(getInsertParameterCounts(25)).toEqual([100]);
  });

  it("splits 26 Custom Field values into D1-safe statements", () => {
    expect(getInsertParameterCounts(26)).toEqual([100, 4]);
  });

  it("batches chunked Custom Field values when creating an Employee", async () => {
    const recording = createRecordingD1({
      query: ({ sql }) => {
        if (sql.includes('from "employees"')) {
          return [getReturnedEmployeeRow()];
        }

        if (sql.includes('from "employee_designations"')) {
          return [["designation-1"]];
        }

        if (sql.includes('from "employee_custom_field_definitions"')) {
          return getCustomFieldDefinitions();
        }

        if (sql.startsWith('insert into "employees"')) {
          return [getReturnedEmployeeRow()];
        }

        return [];
      },
    });
    const records = buildEmployeeRecordsModule({
      db: drizzle(recording.client, { schema }) as never,
    });

    await records.createEmployee("institution-1", getEmployeeInput());

    expect(recording.batches).toHaveLength(1);
    expect(recording.batches[0]?.map((statement) => statement.params.length)).toEqual([14, 100, 4]);
    expect(recording.batches[0]?.[0]?.sql.startsWith('insert into "employees"')).toBe(true);
  });

  it("atomically replaces chunked Custom Field values with a definition subquery", async () => {
    const recording = createRecordingD1({
      query: ({ sql }) => {
        if (sql.includes('from "employees"')) {
          return [["employee-1"]];
        }

        if (sql.includes('from "employee_designations"')) {
          return [["designation-1"]];
        }

        if (sql.includes('from "employee_custom_field_definitions"')) {
          return getCustomFieldDefinitions();
        }

        if (sql.startsWith('update "employees"')) {
          return [getReturnedEmployeeRow()];
        }

        return [];
      },
    });
    const records = buildEmployeeRecordsModule({
      db: drizzle(recording.client, { schema }) as never,
    });

    await records.updateEmployee("institution-1", {
      employeeId: "employee-1",
      ...getEmployeeInput(),
    });

    expect(recording.batches).toHaveLength(1);
    expect(recording.batches[0]?.map((statement) => statement.params.length)).toEqual([
      15, 3, 100, 4,
    ]);
    expect(recording.batches[0]?.[1]?.sql).toContain(
      'in (select "id" from "employee_custom_field_definitions"',
    );
  });

  it("rolls back create at every Employee batch position", async () => {
    for (const failBatchAt of [0, 1, 2]) {
      const sqlite = await createSqliteD1({ failBatchAt });
      await sqlite.executeMultiple(getAtomicWriteDatabaseSql(false));
      const records = buildEmployeeRecordsModule({
        db: drizzle(sqlite.client, { schema }) as never,
      });

      await expect(records.createEmployee("institution-1", getEmployeeInput())).rejects.toThrow();
      expect((await sqlite.execute("select id from employees")).rows).toHaveLength(0);
      expect(
        (await sqlite.execute("select id from employee_custom_field_values")).rows,
      ).toHaveLength(0);
      sqlite.close();
    }
  });

  it("rolls back update at every Employee batch position", async () => {
    for (const failBatchAt of [0, 1, 2, 3]) {
      const sqlite = await createSqliteD1({ failBatchAt });
      await sqlite.executeMultiple(getAtomicWriteDatabaseSql(true));
      const records = buildEmployeeRecordsModule({
        db: drizzle(sqlite.client, { schema }) as never,
      });

      await expect(
        records.updateEmployee("institution-1", {
          employeeId: "employee-1",
          ...getEmployeeInput(),
        }),
      ).rejects.toThrow();
      expect((await sqlite.execute("select first_name from employees")).rows).toEqual([
        { first_name: "Old" },
      ]);
      expect(
        (await sqlite.execute("select value from employee_custom_field_values")).rows,
      ).toHaveLength(recordCount);
      expect(
        (
          await sqlite.execute(
            "select count(*) as changed from employee_custom_field_values where value not like 'Old %'",
          )
        ).rows,
      ).toEqual([{ changed: 0 }]);
      sqlite.close();
    }
  });
});

describe("Employee record Custom Field validation", () => {
  const fieldDefinitions = [
    { id: "field-required", label: "Badge number", isRequired: true },
    { id: "field-optional", label: "Locker", isRequired: false },
  ];

  it("rejects blank submitted values for required Custom Fields", () => {
    expect(() =>
      validateSubmittedCustomFields(fieldDefinitions, {
        "field-required": "   ",
      }),
    ).toThrow(TRPCError);
  });

  it("rejects unknown Custom Field IDs", () => {
    expect(() =>
      validateSubmittedCustomFields(fieldDefinitions, {
        "field-required": "BN-1",
        "foreign-field": "nope",
      }),
    ).toThrow("Employee form contains invalid custom fields");
  });

  it("accepts optional blanks when required Custom Fields are present", () => {
    expect(() =>
      validateSubmittedCustomFields(fieldDefinitions, {
        "field-required": "BN-1",
        "field-optional": "",
      }),
    ).not.toThrow();
  });
});

describe("Employee record write authority", () => {
  const databaseSql = `
    create table employee_designations (
      id text primary key, institution_id text not null, name text not null,
      is_active integer not null, sort_order integer not null,
      created_at integer default 0 not null, updated_at integer default 0 not null
    );
    create table employees (
      id text primary key, institution_id text not null, first_name text not null,
      middle_name text not null, surname text not null, date_of_birth text not null,
      gender text not null, designation_id text not null, seniority_rank integer not null,
      pan_number text, pf_number text, nps_account_number text, whatsapp_number text,
      contact_number text, created_at integer default 0 not null, updated_at integer default 0 not null
    );
    create table employee_custom_field_definitions (
      id text primary key, institution_id text not null, label text not null, key text not null,
      is_required integer not null, is_active integer not null, sort_order integer not null,
      created_at integer default 0 not null, updated_at integer default 0 not null
    );
    create table employee_custom_field_values (
      id text primary key, employee_id text not null, field_definition_id text not null,
      value text not null, created_at integer default 0 not null, updated_at integer default 0 not null
    );
    insert into employee_designations values
      ('designation-active', 'institution-1', 'Teacher', 1, 1, 0, 0),
      ('designation-archived', 'institution-1', 'Clerk', 0, 2, 0, 0),
      ('designation-foreign', 'institution-2', 'Principal', 1, 1, 0, 0);
    insert into employee_custom_field_definitions values
      ('field-required', 'institution-1', 'Badge number', 'badge_number', 1, 1, 1, 0, 0),
      ('field-inactive', 'institution-1', 'Old code', 'old_code', 0, 0, 2, 0, 0),
      ('field-foreign', 'institution-2', 'Foreign code', 'foreign_code', 0, 1, 1, 0, 0);
    insert into employees values
      ('employee-1', 'institution-1', 'Old', 'R', 'Employee', '1990-01-01', 'Female',
       'designation-active', 1, null, null, null, null, null, 0, 0);
  `;

  function getInput() {
    return {
      firstName: "Asha",
      middleName: "R",
      surname: "Patel",
      dateOfBirth: "1990-01-01",
      gender: "Female" as const,
      designationId: "designation-active",
      seniorityRank: 1,
      panNumber: "",
      pfNumber: "",
      npsAccountNumber: "",
      whatsAppNumber: "",
      contactNumber: "",
      customFieldValues: { "field-required": "BN-1" },
    };
  }

  async function createRecords() {
    const sqlite = await createSqliteD1();
    await sqlite.executeMultiple(databaseSql);
    return {
      sqlite,
      records: buildEmployeeRecordsModule({
        db: drizzle(sqlite.client, { schema }) as never,
      }),
    };
  }

  it.each(["designation-archived", "designation-foreign"])(
    "rejects %s for create and update",
    async (designationId) => {
      const { sqlite, records } = await createRecords();
      const input = { ...getInput(), designationId };

      await expect(records.createEmployee("institution-1", input)).rejects.toThrow(
        "Please select a valid designation",
      );
      await expect(
        records.updateEmployee("institution-1", { employeeId: "employee-1", ...input }),
      ).rejects.toThrow("Please select a valid designation");
      sqlite.close();
    },
  );

  it.each(["field-inactive", "field-foreign"])(
    "rejects submitted %s values for create and update",
    async (fieldId) => {
      const { sqlite, records } = await createRecords();
      const input = {
        ...getInput(),
        customFieldValues: { "field-required": "BN-1", [fieldId]: "not allowed" },
      };

      await expect(records.createEmployee("institution-1", input)).rejects.toThrow(
        "Employee form contains invalid custom fields",
      );
      await expect(
        records.updateEmployee("institution-1", { employeeId: "employee-1", ...input }),
      ).rejects.toThrow("Employee form contains invalid custom fields");
      sqlite.close();
    },
  );

  it("rejects missing required Custom Fields for create and update", async () => {
    const { sqlite, records } = await createRecords();
    const input = { ...getInput(), customFieldValues: { "field-required": " " } };

    await expect(records.createEmployee("institution-1", input)).rejects.toThrow(
      "Badge number is required",
    );
    await expect(
      records.updateEmployee("institution-1", { employeeId: "employee-1", ...input }),
    ).rejects.toThrow("Badge number is required");
    sqlite.close();
  });
});

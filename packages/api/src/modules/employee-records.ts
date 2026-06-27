import { createDb } from "@paybuddy/db";
import {
  employeeCustomFieldDefinitions,
  employeeCustomFieldValues,
  employeeDesignations,
  employees,
} from "@paybuddy/db/schema/index";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, inArray } from "drizzle-orm";

import type { CreateEmployeeInput, UpdateEmployeeInput } from "../schemas/employees";

type Db = ReturnType<typeof createDb>;

type ActiveCustomFieldDefinition = {
  id: string;
  label: string;
  key: string;
  isRequired: boolean;
  sortOrder: number;
};

type ActiveDesignation = {
  id: string;
  name: string;
  sortOrder: number;
};

type EmployeeRecordModuleOptions = {
  db?: Db;
};

export type EmployeeDirectoryColumn = {
  key: string;
  label: string;
  defaultVisible: boolean;
  kind: "fixed" | "custom";
  fieldDefinitionId: string | null;
};

export type EmployeeDirectoryRow = {
  id: string;
  firstName: string;
  middleName: string;
  surname: string;
  dateOfBirth: string;
  gender: "Male" | "Female";
  designationId: string;
  designationName: string;
  designationIsActive: boolean;
  seniorityRank: number;
  panNumber: string | null;
  pfNumber: string | null;
  npsAccountNumber: string | null;
  whatsAppNumber: string | null;
  contactNumber: string | null;
  createdAt: Date;
  updatedAt: Date;
  values: Record<string, string | number | null>;
};

export type EmployeeDirectory = {
  columns: EmployeeDirectoryColumn[];
  rows: EmployeeDirectoryRow[];
};

export type EmployeeFormInitialValues = {
  firstName: string;
  middleName: string;
  surname: string;
  dateOfBirth: string;
  gender: "Male" | "Female" | "";
  designationId: string;
  seniorityRank: string;
  panNumber: string;
  pfNumber: string;
  npsAccountNumber: string;
  whatsAppNumber: string;
  contactNumber: string;
  customFieldValues: Record<string, string>;
};

export type EmployeeFormDefinition = {
  designations: ActiveDesignation[];
  customFields: ActiveCustomFieldDefinition[];
  initialValues: EmployeeFormInitialValues;
};

const fixedDirectoryColumns: EmployeeDirectoryColumn[] = [
  { key: "employee", label: "Employee", defaultVisible: true, kind: "fixed", fieldDefinitionId: null },
  { key: "rank", label: "Rank", defaultVisible: true, kind: "fixed", fieldDefinitionId: null },
  { key: "designation", label: "Designation", defaultVisible: true, kind: "fixed", fieldDefinitionId: null },
  { key: "dateOfBirth", label: "Date of Birth", defaultVisible: false, kind: "fixed", fieldDefinitionId: null },
  { key: "gender", label: "Gender", defaultVisible: false, kind: "fixed", fieldDefinitionId: null },
  { key: "contactNumber", label: "Contact", defaultVisible: true, kind: "fixed", fieldDefinitionId: null },
  { key: "whatsAppNumber", label: "WhatsApp", defaultVisible: false, kind: "fixed", fieldDefinitionId: null },
  { key: "panNumber", label: "PAN", defaultVisible: false, kind: "fixed", fieldDefinitionId: null },
  { key: "pfNumber", label: "PF", defaultVisible: false, kind: "fixed", fieldDefinitionId: null },
  { key: "npsAccountNumber", label: "NPS", defaultVisible: false, kind: "fixed", fieldDefinitionId: null },
  { key: "created", label: "Created", defaultVisible: true, kind: "fixed", fieldDefinitionId: null },
];

export const emptyEmployeeFormInitialValues: EmployeeFormInitialValues = {
  firstName: "",
  middleName: "",
  surname: "",
  dateOfBirth: "",
  gender: "",
  designationId: "",
  seniorityRank: "",
  panNumber: "",
  pfNumber: "",
  npsAccountNumber: "",
  whatsAppNumber: "",
  contactNumber: "",
  customFieldValues: {},
};

function toNullableText(value: string | undefined) {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 ? normalized : null;
}

function getCustomFieldColumnKey(fieldDefinitionId: string) {
  return `customField:${fieldDefinitionId}`;
}

function toInitialValues(input: {
  firstName: string;
  middleName: string;
  surname: string;
  dateOfBirth: string;
  gender: "Male" | "Female";
  designationId: string;
  seniorityRank: number;
  panNumber: string | null;
  pfNumber: string | null;
  npsAccountNumber: string | null;
  whatsAppNumber: string | null;
  contactNumber: string | null;
  customFieldValues: Record<string, string>;
}): EmployeeFormInitialValues {
  return {
    firstName: input.firstName,
    middleName: input.middleName,
    surname: input.surname,
    dateOfBirth: input.dateOfBirth,
    gender: input.gender,
    designationId: input.designationId,
    seniorityRank: String(input.seniorityRank),
    panNumber: input.panNumber ?? "",
    pfNumber: input.pfNumber ?? "",
    npsAccountNumber: input.npsAccountNumber ?? "",
    whatsAppNumber: input.whatsAppNumber ?? "",
    contactNumber: input.contactNumber ?? "",
    customFieldValues: input.customFieldValues,
  };
}

function groupCustomFieldValues(
  customFieldRows: Array<{
    employeeId: string;
    fieldDefinitionId: string;
    value: string;
  }>,
) {
  const customFieldsByEmployee = new Map<string, Record<string, string>>();

  for (const field of customFieldRows) {
    const current = customFieldsByEmployee.get(field.employeeId) ?? {};
    current[field.fieldDefinitionId] = field.value;
    customFieldsByEmployee.set(field.employeeId, current);
  }

  return customFieldsByEmployee;
}

export function validateSubmittedCustomFields(
  fieldDefinitions: Array<{ id: string; label: string; isRequired: boolean }>,
  customFieldValues: Record<string, string>,
) {
  const fieldDefinitionIds = new Set(fieldDefinitions.map((field) => field.id));
  const submittedFieldIds = Object.keys(customFieldValues);

  if (submittedFieldIds.some((fieldId) => !fieldDefinitionIds.has(fieldId))) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Employee form contains invalid custom fields",
    });
  }

  for (const field of fieldDefinitions) {
    if (field.isRequired && !(customFieldValues[field.id]?.trim() ?? "")) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `${field.label} is required`,
      });
    }
  }
}

export function buildEmployeeRecordsModule(options: EmployeeRecordModuleOptions = {}) {
  const db = options.db ?? createDb();

  async function getActiveDesignations(institutionId: string) {
    return db
      .select({
        id: employeeDesignations.id,
        name: employeeDesignations.name,
        sortOrder: employeeDesignations.sortOrder,
      })
      .from(employeeDesignations)
      .where(and(eq(employeeDesignations.institutionId, institutionId), eq(employeeDesignations.isActive, true)))
      .orderBy(asc(employeeDesignations.sortOrder), asc(employeeDesignations.name));
  }

  async function getActiveCustomFieldDefinitions(institutionId: string) {
    return db
      .select({
        id: employeeCustomFieldDefinitions.id,
        label: employeeCustomFieldDefinitions.label,
        key: employeeCustomFieldDefinitions.key,
        isRequired: employeeCustomFieldDefinitions.isRequired,
        sortOrder: employeeCustomFieldDefinitions.sortOrder,
      })
      .from(employeeCustomFieldDefinitions)
      .where(
        and(
          eq(employeeCustomFieldDefinitions.institutionId, institutionId),
          eq(employeeCustomFieldDefinitions.isActive, true),
        ),
      )
      .orderBy(asc(employeeCustomFieldDefinitions.sortOrder), asc(employeeCustomFieldDefinitions.label));
  }

  async function getActiveDesignation(institutionId: string, designationId: string) {
    return db
      .select({ id: employeeDesignations.id })
      .from(employeeDesignations)
      .where(
        and(
          eq(employeeDesignations.id, designationId),
          eq(employeeDesignations.institutionId, institutionId),
          eq(employeeDesignations.isActive, true),
        ),
      )
      .get();
  }

  async function getCustomFieldRowsForEmployees(institutionId: string, employeeIds: string[]) {
    if (employeeIds.length === 0) {
      return [];
    }

    return db
      .select({
        employeeId: employeeCustomFieldValues.employeeId,
        fieldDefinitionId: employeeCustomFieldDefinitions.id,
        value: employeeCustomFieldValues.value,
      })
      .from(employeeCustomFieldValues)
      .innerJoin(
        employeeCustomFieldDefinitions,
        eq(employeeCustomFieldDefinitions.id, employeeCustomFieldValues.fieldDefinitionId),
      )
      .where(
        and(
          inArray(employeeCustomFieldValues.employeeId, employeeIds),
          eq(employeeCustomFieldDefinitions.institutionId, institutionId),
        ),
      )
      .orderBy(asc(employeeCustomFieldDefinitions.sortOrder), asc(employeeCustomFieldDefinitions.label));
  }

  async function getEmployeeBaseById(institutionId: string, employeeId: string) {
    return db
      .select({
        id: employees.id,
        firstName: employees.firstName,
        middleName: employees.middleName,
        surname: employees.surname,
        dateOfBirth: employees.dateOfBirth,
        gender: employees.gender,
        panNumber: employees.panNumber,
        pfNumber: employees.pfNumber,
        npsAccountNumber: employees.npsAccountNumber,
        whatsAppNumber: employees.whatsAppNumber,
        contactNumber: employees.contactNumber,
        createdAt: employees.createdAt,
        updatedAt: employees.updatedAt,
        seniorityRank: employees.seniorityRank,
        designationId: employeeDesignations.id,
        designationName: employeeDesignations.name,
        designationIsActive: employeeDesignations.isActive,
      })
      .from(employees)
      .innerJoin(employeeDesignations, eq(employeeDesignations.id, employees.designationId))
      .where(and(eq(employees.id, employeeId), eq(employees.institutionId, institutionId)))
      .get();
  }

  async function getDirectory(institutionId: string): Promise<EmployeeDirectory> {
    const [customFields, employeeRows] = await Promise.all([
      getActiveCustomFieldDefinitions(institutionId),
      db
        .select({
          id: employees.id,
          firstName: employees.firstName,
          middleName: employees.middleName,
          surname: employees.surname,
          dateOfBirth: employees.dateOfBirth,
          gender: employees.gender,
          panNumber: employees.panNumber,
          pfNumber: employees.pfNumber,
          npsAccountNumber: employees.npsAccountNumber,
          whatsAppNumber: employees.whatsAppNumber,
          contactNumber: employees.contactNumber,
          createdAt: employees.createdAt,
          updatedAt: employees.updatedAt,
          seniorityRank: employees.seniorityRank,
          designationId: employeeDesignations.id,
          designationName: employeeDesignations.name,
          designationIsActive: employeeDesignations.isActive,
        })
        .from(employees)
        .innerJoin(employeeDesignations, eq(employeeDesignations.id, employees.designationId))
        .where(eq(employees.institutionId, institutionId))
        .orderBy(
          asc(employees.seniorityRank),
          asc(employeeDesignations.sortOrder),
          asc(employees.surname),
          asc(employees.firstName),
        ),
    ]);

    const customFieldsByEmployee = groupCustomFieldValues(
      await getCustomFieldRowsForEmployees(institutionId, employeeRows.map((row) => row.id)),
    );

    return {
      columns: [
        ...fixedDirectoryColumns,
        ...customFields.map((field) => ({
          key: getCustomFieldColumnKey(field.id),
          label: field.label,
          defaultVisible: false,
          kind: "custom" as const,
          fieldDefinitionId: field.id,
        })),
      ],
      rows: employeeRows.map((row) => {
        const customFieldValues = customFieldsByEmployee.get(row.id) ?? {};
        return {
          ...row,
          values: {
            employee: `${row.surname}, ${row.firstName} ${row.middleName}`.trim(),
            rank: row.seniorityRank,
            designation: row.designationIsActive
              ? row.designationName
              : `${row.designationName} (archived)`,
            dateOfBirth: row.dateOfBirth,
            gender: row.gender,
            contactNumber: row.contactNumber,
            whatsAppNumber: row.whatsAppNumber,
            panNumber: row.panNumber,
            pfNumber: row.pfNumber,
            npsAccountNumber: row.npsAccountNumber,
            created: row.createdAt.toISOString(),
            ...Object.fromEntries(
              Object.entries(customFieldValues).map(([fieldDefinitionId, value]) => [
                getCustomFieldColumnKey(fieldDefinitionId),
                value,
              ]),
            ),
          },
        };
      }),
    };
  }

  async function getCreateForm(institutionId: string): Promise<EmployeeFormDefinition> {
    const [designations, customFields] = await Promise.all([
      getActiveDesignations(institutionId),
      getActiveCustomFieldDefinitions(institutionId),
    ]);

    return {
      designations,
      customFields,
      initialValues: emptyEmployeeFormInitialValues,
    };
  }

  async function getEditForm(institutionId: string, employeeId: string): Promise<EmployeeFormDefinition> {
    const [formDefinition, employeeRow] = await Promise.all([
      getCreateForm(institutionId),
      getEmployeeBaseById(institutionId, employeeId),
    ]);

    if (!employeeRow) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Employee not found",
      });
    }

    const customFieldsByEmployee = groupCustomFieldValues(
      await getCustomFieldRowsForEmployees(institutionId, [employeeRow.id]),
    );

    return {
      ...formDefinition,
      initialValues: toInitialValues({
        ...employeeRow,
        customFieldValues: customFieldsByEmployee.get(employeeRow.id) ?? {},
      }),
    };
  }

  async function createEmployee(institutionId: string, input: CreateEmployeeInput) {
    const designation = await getActiveDesignation(institutionId, input.designationId);

    if (!designation) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Please select a valid designation",
      });
    }

    const fieldDefinitions = await getActiveCustomFieldDefinitions(institutionId);
    validateSubmittedCustomFields(fieldDefinitions, input.customFieldValues);

    const [createdEmployee] = await db
      .insert(employees)
      .values({
        id: crypto.randomUUID(),
        institutionId,
        firstName: input.firstName.trim(),
        middleName: input.middleName.trim(),
        surname: input.surname.trim(),
        dateOfBirth: input.dateOfBirth.trim(),
        gender: input.gender,
        designationId: input.designationId,
        seniorityRank: input.seniorityRank,
        panNumber: toNullableText(input.panNumber),
        pfNumber: toNullableText(input.pfNumber),
        npsAccountNumber: toNullableText(input.npsAccountNumber),
        whatsAppNumber: toNullableText(input.whatsAppNumber),
        contactNumber: toNullableText(input.contactNumber),
      })
      .returning();

    if (!createdEmployee) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Unable to create employee",
      });
    }

    const customFieldValuesToInsert = fieldDefinitions
      .map((field) => ({
        fieldDefinitionId: field.id,
        value: input.customFieldValues[field.id]?.trim() ?? "",
      }))
      .filter((field) => field.value.length > 0)
      .map((field) => ({
        id: crypto.randomUUID(),
        employeeId: createdEmployee.id,
        fieldDefinitionId: field.fieldDefinitionId,
        value: field.value,
      }));

    if (customFieldValuesToInsert.length > 0) {
      await db.insert(employeeCustomFieldValues).values(customFieldValuesToInsert);
    }

    return createdEmployee;
  }

  async function updateEmployee(institutionId: string, input: UpdateEmployeeInput) {
    const existingEmployee = await db
      .select({ id: employees.id })
      .from(employees)
      .where(and(eq(employees.id, input.employeeId), eq(employees.institutionId, institutionId)))
      .get();

    if (!existingEmployee) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Employee not found",
      });
    }

    const designation = await getActiveDesignation(institutionId, input.designationId);

    if (!designation) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Please select a valid designation",
      });
    }

    const fieldDefinitions = await getActiveCustomFieldDefinitions(institutionId);
    validateSubmittedCustomFields(fieldDefinitions, input.customFieldValues);

    const activeFieldDefinitionIds = fieldDefinitions.map((field) => field.id);
    const customFieldValuesToInsert = fieldDefinitions
      .map((field) => ({
        fieldDefinitionId: field.id,
        value: input.customFieldValues[field.id]?.trim() ?? "",
      }))
      .filter((field) => field.value.length > 0)
      .map((field) => ({
        id: crypto.randomUUID(),
        employeeId: input.employeeId,
        fieldDefinitionId: field.fieldDefinitionId,
        value: field.value,
      }));

    const [updatedEmployee] = await db
      .update(employees)
      .set({
        firstName: input.firstName.trim(),
        middleName: input.middleName.trim(),
        surname: input.surname.trim(),
        dateOfBirth: input.dateOfBirth.trim(),
        gender: input.gender,
        designationId: input.designationId,
        seniorityRank: input.seniorityRank,
        panNumber: toNullableText(input.panNumber),
        pfNumber: toNullableText(input.pfNumber),
        npsAccountNumber: toNullableText(input.npsAccountNumber),
        whatsAppNumber: toNullableText(input.whatsAppNumber),
        contactNumber: toNullableText(input.contactNumber),
      })
      .where(and(eq(employees.id, input.employeeId), eq(employees.institutionId, institutionId)))
      .returning();

    if (!updatedEmployee) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Unable to update employee",
      });
    }

    if (activeFieldDefinitionIds.length > 0) {
      await db
        .delete(employeeCustomFieldValues)
        .where(
          and(
            eq(employeeCustomFieldValues.employeeId, input.employeeId),
            inArray(employeeCustomFieldValues.fieldDefinitionId, activeFieldDefinitionIds),
          ),
        );
    }

    if (customFieldValuesToInsert.length > 0) {
      await db.insert(employeeCustomFieldValues).values(customFieldValuesToInsert);
    }

    return updatedEmployee;
  }

  async function deleteEmployee(institutionId: string, employeeId: string) {
    const [deletedEmployee] = await db
      .delete(employees)
      .where(and(eq(employees.id, employeeId), eq(employees.institutionId, institutionId)))
      .returning();

    if (!deletedEmployee) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Employee not found",
      });
    }

    return { success: true };
  }

  return {
    getDirectory,
    getCreateForm,
    getEditForm,
    createEmployee,
    updateEmployee,
    deleteEmployee,
  };
}

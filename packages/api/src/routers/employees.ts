import {
  employeeCustomFieldDefinitions,
  employeeCustomFieldValues,
  employeeDesignations,
  employees,
} from "@paybuddy/db/schema/index";
import { and, asc, eq, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

import { createDb } from "@paybuddy/db";

import { institutionProcedure, router } from "../index";
import {
  createEmployeeSchema,
  employeeIdSchema,
  updateEmployeeSchema,
} from "../schemas/employees";

const db = createDb();

function toNullableText(value: string | undefined) {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 ? normalized : null;
}

async function getEmployeeBaseById(institutionId: string, employeeId: string) {
  return db
    .select({
      id: employees.id,
      firstName: employees.firstName,
      middleName: employees.middleName,
      surname: employees.surname,
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
      designationSortOrder: employeeDesignations.sortOrder,
    })
    .from(employees)
    .innerJoin(employeeDesignations, eq(employeeDesignations.id, employees.designationId))
    .where(and(eq(employees.id, employeeId), eq(employees.institutionId, institutionId)))
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
      label: employeeCustomFieldDefinitions.label,
      value: employeeCustomFieldValues.value,
      sortOrder: employeeCustomFieldDefinitions.sortOrder,
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

function groupCustomFieldsByEmployee(
  customFieldRows: Array<{
    employeeId: string;
    fieldDefinitionId: string;
    label: string;
    value: string;
  }>,
) {
  const customFieldsByEmployee = new Map<
    string,
    Array<{ fieldDefinitionId: string; label: string; value: string }>
  >();

  for (const field of customFieldRows) {
    const current = customFieldsByEmployee.get(field.employeeId) ?? [];
    current.push({
      fieldDefinitionId: field.fieldDefinitionId,
      label: field.label,
      value: field.value,
    });
    customFieldsByEmployee.set(field.employeeId, current);
  }

  return customFieldsByEmployee;
}

async function getActiveDesignation(institutionId: string, designationId: string) {
  return db
    .select({
      id: employeeDesignations.id,
    })
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

async function getActiveCustomFieldDefinitions(institutionId: string) {
  return db
    .select({
      id: employeeCustomFieldDefinitions.id,
      label: employeeCustomFieldDefinitions.label,
      isRequired: employeeCustomFieldDefinitions.isRequired,
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

function validateSubmittedCustomFields(
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
    if (field.isRequired) {
      const value = customFieldValues[field.id]?.trim() ?? "";

      if (!value) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `${field.label} is required`,
        });
      }
    }
  }
}

export const employeesRouter = router({
  list: institutionProcedure.query(async ({ ctx }) => {
    const employeeRows = await db
      .select({
        id: employees.id,
        firstName: employees.firstName,
        middleName: employees.middleName,
        surname: employees.surname,
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
        designationSortOrder: employeeDesignations.sortOrder,
      })
      .from(employees)
      .innerJoin(employeeDesignations, eq(employeeDesignations.id, employees.designationId))
      .where(eq(employees.institutionId, ctx.institution.id))
      .orderBy(
        asc(employees.seniorityRank),
        asc(employeeDesignations.sortOrder),
        asc(employees.surname),
        asc(employees.firstName),
      );

    const employeeIds = employeeRows.map((row) => row.id);
    const customFieldRows = await getCustomFieldRowsForEmployees(ctx.institution.id, employeeIds);
    const customFieldsByEmployee = groupCustomFieldsByEmployee(customFieldRows);

    return employeeRows.map((row) => ({
      ...row,
      customFields: customFieldsByEmployee.get(row.id) ?? [],
    }));
  }),
  getById: institutionProcedure.input(employeeIdSchema).query(async ({ ctx, input }) => {
    const employeeRow = await getEmployeeBaseById(ctx.institution.id, input.employeeId);

    if (!employeeRow) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Employee not found",
      });
    }

    const customFieldRows = await getCustomFieldRowsForEmployees(ctx.institution.id, [
      employeeRow.id,
    ]);
    const customFieldsByEmployee = groupCustomFieldsByEmployee(customFieldRows);

    return {
      ...employeeRow,
      customFields: customFieldsByEmployee.get(employeeRow.id) ?? [],
    };
  }),
  create: institutionProcedure.input(createEmployeeSchema).mutation(async ({ ctx, input }) => {
    const designation = await getActiveDesignation(ctx.institution.id, input.designationId);

    if (!designation) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Please select a valid designation",
      });
    }

    const fieldDefinitions = await getActiveCustomFieldDefinitions(ctx.institution.id);
    validateSubmittedCustomFields(fieldDefinitions, input.customFieldValues);

    const [createdEmployee] = await db
      .insert(employees)
      .values({
        id: crypto.randomUUID(),
        institutionId: ctx.institution.id,
        firstName: input.firstName.trim(),
        middleName: input.middleName.trim(),
        surname: input.surname.trim(),
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
  }),
  update: institutionProcedure.input(updateEmployeeSchema).mutation(async ({ ctx, input }) => {
    const existingEmployee = await db
      .select({ id: employees.id })
      .from(employees)
      .where(and(eq(employees.id, input.employeeId), eq(employees.institutionId, ctx.institution.id)))
      .get();

    if (!existingEmployee) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Employee not found",
      });
    }

    const designation = await getActiveDesignation(ctx.institution.id, input.designationId);

    if (!designation) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Please select a valid designation",
      });
    }

    const fieldDefinitions = await getActiveCustomFieldDefinitions(ctx.institution.id);
    validateSubmittedCustomFields(fieldDefinitions, input.customFieldValues);

    const [updatedEmployee] = await db
      .update(employees)
      .set({
        firstName: input.firstName.trim(),
        middleName: input.middleName.trim(),
        surname: input.surname.trim(),
        designationId: input.designationId,
        seniorityRank: input.seniorityRank,
        panNumber: toNullableText(input.panNumber),
        pfNumber: toNullableText(input.pfNumber),
        npsAccountNumber: toNullableText(input.npsAccountNumber),
        whatsAppNumber: toNullableText(input.whatsAppNumber),
        contactNumber: toNullableText(input.contactNumber),
      })
      .where(and(eq(employees.id, input.employeeId), eq(employees.institutionId, ctx.institution.id)))
      .returning();

    if (!updatedEmployee) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Unable to update employee",
      });
    }

    await db
      .delete(employeeCustomFieldValues)
      .where(eq(employeeCustomFieldValues.employeeId, input.employeeId));

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

    if (customFieldValuesToInsert.length > 0) {
      await db.insert(employeeCustomFieldValues).values(customFieldValuesToInsert);
    }

    return updatedEmployee;
  }),
  delete: institutionProcedure.input(employeeIdSchema).mutation(async ({ ctx, input }) => {
    const [deletedEmployee] = await db
      .delete(employees)
      .where(and(eq(employees.id, input.employeeId), eq(employees.institutionId, ctx.institution.id)))
      .returning();

    if (!deletedEmployee) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Employee not found",
      });
    }

    return { success: true };
  }),
  getCreateFormOptions: institutionProcedure.query(async ({ ctx }) => {
    const [designations, customFields] = await Promise.all([
      db
        .select({
          id: employeeDesignations.id,
          name: employeeDesignations.name,
          sortOrder: employeeDesignations.sortOrder,
        })
        .from(employeeDesignations)
        .where(
          and(
            eq(employeeDesignations.institutionId, ctx.institution.id),
            eq(employeeDesignations.isActive, true),
          ),
        )
        .orderBy(asc(employeeDesignations.sortOrder), asc(employeeDesignations.name)),
      db
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
            eq(employeeCustomFieldDefinitions.institutionId, ctx.institution.id),
            eq(employeeCustomFieldDefinitions.isActive, true),
          ),
        )
        .orderBy(asc(employeeCustomFieldDefinitions.sortOrder), asc(employeeCustomFieldDefinitions.label)),
    ]);

    return {
      designations,
      customFields,
    };
  }),
});

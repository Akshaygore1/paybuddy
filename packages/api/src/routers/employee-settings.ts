import {
  employeeCustomFieldDefinitions,
  employeeDesignations,
} from "@paybuddy/db/schema/index";
import { and, asc, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

import { createDb } from "@paybuddy/db";

import { institutionProcedure, router } from "../index";
import {
  addCustomFieldSchema,
  archiveEntitySchema,
  createDesignationSchema,
  defaultEmployeeFieldDefinitions,
  reorderEntitySchema,
} from "../schemas/employees";

const db = createDb();

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function buildFieldKeyBase(label: string) {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return slug || "field";
}

async function getNextSortOrderForDefinitions(institutionId: string) {
  const current = await db
    .select({ sortOrder: employeeCustomFieldDefinitions.sortOrder })
    .from(employeeCustomFieldDefinitions)
    .where(eq(employeeCustomFieldDefinitions.institutionId, institutionId))
    .orderBy(desc(employeeCustomFieldDefinitions.sortOrder))
    .get();

  return (current?.sortOrder ?? 0) + 1;
}

async function getNextSortOrderForDesignations(institutionId: string) {
  const current = await db
    .select({ sortOrder: employeeDesignations.sortOrder })
    .from(employeeDesignations)
    .where(eq(employeeDesignations.institutionId, institutionId))
    .orderBy(desc(employeeDesignations.sortOrder))
    .get();

  return (current?.sortOrder ?? 0) + 1;
}

export const employeeSettingsRouter = router({
  getFormConfig: institutionProcedure.query(async ({ ctx }) => {
    const [customFields, designations] = await Promise.all([
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
    ]);

    return {
      defaultFields: defaultEmployeeFieldDefinitions,
      customFields,
      designations,
    };
  }),
  addCustomField: institutionProcedure
    .input(addCustomFieldSchema)
    .mutation(async ({ ctx, input }) => {
      const existingFields = await db
        .select({
          id: employeeCustomFieldDefinitions.id,
          label: employeeCustomFieldDefinitions.label,
          key: employeeCustomFieldDefinitions.key,
          isActive: employeeCustomFieldDefinitions.isActive,
        })
        .from(employeeCustomFieldDefinitions)
        .where(eq(employeeCustomFieldDefinitions.institutionId, ctx.institution.id));

      const normalizedLabel = normalizeText(input.label);

      if (
        existingFields.some(
          (field) => field.isActive && normalizeText(field.label) === normalizedLabel,
        )
      ) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A custom field with this label already exists",
        });
      }

      const baseKey = buildFieldKeyBase(input.label);
      const existingKeys = new Set(existingFields.map((field) => field.key));
      let key = baseKey;
      let suffix = 2;

      while (existingKeys.has(key)) {
        key = `${baseKey}_${suffix}`;
        suffix += 1;
      }

      const [createdField] = await db
        .insert(employeeCustomFieldDefinitions)
        .values({
          id: crypto.randomUUID(),
          institutionId: ctx.institution.id,
          label: input.label.trim(),
          key,
          isRequired: input.isRequired,
          sortOrder: await getNextSortOrderForDefinitions(ctx.institution.id),
        })
        .returning();

      return createdField;
    }),
  reorderCustomFields: institutionProcedure
    .input(reorderEntitySchema)
    .mutation(async ({ ctx, input }) => {
      const existingFields = await db
        .select({ id: employeeCustomFieldDefinitions.id })
        .from(employeeCustomFieldDefinitions)
        .where(
          and(
            eq(employeeCustomFieldDefinitions.institutionId, ctx.institution.id),
            eq(employeeCustomFieldDefinitions.isActive, true),
          ),
        )
        .orderBy(asc(employeeCustomFieldDefinitions.sortOrder));

      if (existingFields.length !== input.orderedIds.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Custom field reorder payload is incomplete",
        });
      }

      const existingIds = new Set(existingFields.map((field) => field.id));

      if (input.orderedIds.some((id) => !existingIds.has(id))) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Custom field reorder payload contains invalid items",
        });
      }

      await Promise.all(
        input.orderedIds.map((fieldId, index) =>
          db
            .update(employeeCustomFieldDefinitions)
            .set({ sortOrder: index + 1 })
            .where(
              and(
                eq(employeeCustomFieldDefinitions.id, fieldId),
                eq(employeeCustomFieldDefinitions.institutionId, ctx.institution.id),
              ),
            ),
        ),
      );

      return { success: true };
    }),
  archiveCustomField: institutionProcedure
    .input(archiveEntitySchema)
    .mutation(async ({ ctx, input }) => {
      const [archivedField] = await db
        .update(employeeCustomFieldDefinitions)
        .set({ isActive: false })
        .where(
          and(
            eq(employeeCustomFieldDefinitions.id, input.id),
            eq(employeeCustomFieldDefinitions.institutionId, ctx.institution.id),
            eq(employeeCustomFieldDefinitions.isActive, true),
          ),
        )
        .returning();

      if (!archivedField) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Custom field was not found",
        });
      }

      return archivedField;
    }),
  listDesignations: institutionProcedure.query(async ({ ctx }) => {
    return db
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
      .orderBy(asc(employeeDesignations.sortOrder), asc(employeeDesignations.name));
  }),
  createDesignation: institutionProcedure
    .input(createDesignationSchema)
    .mutation(async ({ ctx, input }) => {
      const existingDesignations = await db
        .select({
          id: employeeDesignations.id,
          name: employeeDesignations.name,
          isActive: employeeDesignations.isActive,
        })
        .from(employeeDesignations)
        .where(eq(employeeDesignations.institutionId, ctx.institution.id));

      const normalizedName = normalizeText(input.name);

      if (
        existingDesignations.some(
          (designation) => designation.isActive && normalizeText(designation.name) === normalizedName,
        )
      ) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A designation with this name already exists",
        });
      }

      const [createdDesignation] = await db
        .insert(employeeDesignations)
        .values({
          id: crypto.randomUUID(),
          institutionId: ctx.institution.id,
          name: input.name.trim(),
          sortOrder: await getNextSortOrderForDesignations(ctx.institution.id),
        })
        .returning();

      return createdDesignation;
    }),
  reorderDesignations: institutionProcedure
    .input(reorderEntitySchema)
    .mutation(async ({ ctx, input }) => {
      const existingDesignations = await db
        .select({ id: employeeDesignations.id })
        .from(employeeDesignations)
        .where(
          and(
            eq(employeeDesignations.institutionId, ctx.institution.id),
            eq(employeeDesignations.isActive, true),
          ),
        )
        .orderBy(asc(employeeDesignations.sortOrder));

      if (existingDesignations.length !== input.orderedIds.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Designation reorder payload is incomplete",
        });
      }

      const existingIds = new Set(existingDesignations.map((designation) => designation.id));

      if (input.orderedIds.some((id) => !existingIds.has(id))) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Designation reorder payload contains invalid items",
        });
      }

      await Promise.all(
        input.orderedIds.map((designationId, index) =>
          db
            .update(employeeDesignations)
            .set({ sortOrder: index + 1 })
            .where(
              and(
                eq(employeeDesignations.id, designationId),
                eq(employeeDesignations.institutionId, ctx.institution.id),
              ),
            ),
        ),
      );

      return { success: true };
    }),
  archiveDesignation: institutionProcedure
    .input(archiveEntitySchema)
    .mutation(async ({ ctx, input }) => {
      const [archivedDesignation] = await db
        .update(employeeDesignations)
        .set({ isActive: false })
        .where(
          and(
            eq(employeeDesignations.id, input.id),
            eq(employeeDesignations.institutionId, ctx.institution.id),
            eq(employeeDesignations.isActive, true),
          ),
        )
        .returning();

      if (!archivedDesignation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Designation was not found",
        });
      }

      return archivedDesignation;
    }),
});

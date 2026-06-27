import { createDb } from "@paybuddy/db";
import {
  employeeCustomFieldDefinitions,
  employeeDesignations,
} from "@paybuddy/db/schema/index";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq } from "drizzle-orm";

import type {
  addCustomFieldSchema,
  archiveEntitySchema,
  createDesignationSchema,
  reorderEntitySchema,
} from "../schemas/employees";
import { defaultEmployeeFieldDefinitions } from "../schemas/employees";
import type { z } from "zod";

type Db = ReturnType<typeof createDb>;

type EmployeeSetupModuleOptions = {
  db?: Db;
};

export type EmployeeSetupDefinition = {
  defaultFields: typeof defaultEmployeeFieldDefinitions;
  customFields: Array<{
    id: string;
    label: string;
    key: string;
    isRequired: boolean;
    sortOrder: number;
  }>;
  designations: Array<{
    id: string;
    name: string;
    sortOrder: number;
  }>;
};

type AddCustomFieldInput = z.infer<typeof addCustomFieldSchema>;
type ArchiveEntityInput = z.infer<typeof archiveEntitySchema>;
type CreateDesignationInput = z.infer<typeof createDesignationSchema>;
type ReorderEntityInput = z.infer<typeof reorderEntitySchema>;

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function buildFieldKeyBase(label: string) {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return slug || "field";
}

export function buildUniqueFieldKey(label: string, existingKeys: Iterable<string>) {
  const baseKey = buildFieldKeyBase(label);
  const unavailableKeys = new Set(existingKeys);
  let key = baseKey;
  let suffix = 2;

  while (unavailableKeys.has(key)) {
    key = `${baseKey}_${suffix}`;
    suffix += 1;
  }

  return key;
}

export function assertNoDuplicateActiveLabel(
  existingFields: Array<{ label: string; isActive: boolean }>,
  label: string,
) {
  const normalizedLabel = normalizeText(label);

  if (existingFields.some((field) => field.isActive && normalizeText(field.label) === normalizedLabel)) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "A custom field with this label already exists",
    });
  }
}

export function assertCompleteReorderPayload(
  existingIds: string[],
  orderedIds: string[],
  entityName: "Custom field" | "Designation",
) {
  if (existingIds.length !== orderedIds.length) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `${entityName} reorder payload is incomplete`,
    });
  }

  const availableIds = new Set(existingIds);

  if (orderedIds.some((id) => !availableIds.has(id))) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `${entityName} reorder payload contains invalid items`,
    });
  }
}

export function buildEmployeeSetupModule(options: EmployeeSetupModuleOptions = {}) {
  const db = options.db ?? createDb();

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

  async function getSetupDefinition(institutionId: string): Promise<EmployeeSetupDefinition> {
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
            eq(employeeCustomFieldDefinitions.institutionId, institutionId),
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
            eq(employeeDesignations.institutionId, institutionId),
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
  }

  async function addCustomField(institutionId: string, input: AddCustomFieldInput) {
    const existingFields = await db
      .select({
        label: employeeCustomFieldDefinitions.label,
        key: employeeCustomFieldDefinitions.key,
        isActive: employeeCustomFieldDefinitions.isActive,
      })
      .from(employeeCustomFieldDefinitions)
      .where(eq(employeeCustomFieldDefinitions.institutionId, institutionId));

    assertNoDuplicateActiveLabel(existingFields, input.label);

    const [createdField] = await db
      .insert(employeeCustomFieldDefinitions)
      .values({
        id: crypto.randomUUID(),
        institutionId,
        label: input.label.trim(),
        key: buildUniqueFieldKey(
          input.label,
          existingFields.map((field) => field.key),
        ),
        isRequired: input.isRequired,
        sortOrder: await getNextSortOrderForDefinitions(institutionId),
      })
      .returning();

    return createdField;
  }

  async function reorderCustomFields(institutionId: string, input: ReorderEntityInput) {
    const existingFields = await db
      .select({ id: employeeCustomFieldDefinitions.id })
      .from(employeeCustomFieldDefinitions)
      .where(
        and(
          eq(employeeCustomFieldDefinitions.institutionId, institutionId),
          eq(employeeCustomFieldDefinitions.isActive, true),
        ),
      )
      .orderBy(asc(employeeCustomFieldDefinitions.sortOrder));

    assertCompleteReorderPayload(
      existingFields.map((field) => field.id),
      input.orderedIds,
      "Custom field",
    );

    await Promise.all(
      input.orderedIds.map((fieldId, index) =>
        db
          .update(employeeCustomFieldDefinitions)
          .set({ sortOrder: index + 1 })
          .where(
            and(
              eq(employeeCustomFieldDefinitions.id, fieldId),
              eq(employeeCustomFieldDefinitions.institutionId, institutionId),
            ),
          ),
      ),
    );

    return { success: true };
  }

  async function archiveCustomField(institutionId: string, input: ArchiveEntityInput) {
    const [archivedField] = await db
      .update(employeeCustomFieldDefinitions)
      .set({ isActive: false })
      .where(
        and(
          eq(employeeCustomFieldDefinitions.id, input.id),
          eq(employeeCustomFieldDefinitions.institutionId, institutionId),
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
  }

  async function createDesignation(institutionId: string, input: CreateDesignationInput) {
    const existingDesignations = await db
      .select({
        name: employeeDesignations.name,
        isActive: employeeDesignations.isActive,
      })
      .from(employeeDesignations)
      .where(eq(employeeDesignations.institutionId, institutionId));

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
        institutionId,
        name: input.name.trim(),
        sortOrder: await getNextSortOrderForDesignations(institutionId),
      })
      .returning();

    return createdDesignation;
  }

  async function reorderDesignations(institutionId: string, input: ReorderEntityInput) {
    const existingDesignations = await db
      .select({ id: employeeDesignations.id })
      .from(employeeDesignations)
      .where(
        and(
          eq(employeeDesignations.institutionId, institutionId),
          eq(employeeDesignations.isActive, true),
        ),
      )
      .orderBy(asc(employeeDesignations.sortOrder));

    assertCompleteReorderPayload(
      existingDesignations.map((designation) => designation.id),
      input.orderedIds,
      "Designation",
    );

    await Promise.all(
      input.orderedIds.map((designationId, index) =>
        db
          .update(employeeDesignations)
          .set({ sortOrder: index + 1 })
          .where(
            and(
              eq(employeeDesignations.id, designationId),
              eq(employeeDesignations.institutionId, institutionId),
            ),
          ),
      ),
    );

    return { success: true };
  }

  async function archiveDesignation(institutionId: string, input: ArchiveEntityInput) {
    const [archivedDesignation] = await db
      .update(employeeDesignations)
      .set({ isActive: false })
      .where(
        and(
          eq(employeeDesignations.id, input.id),
          eq(employeeDesignations.institutionId, institutionId),
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
  }

  return {
    getSetupDefinition,
    addCustomField,
    reorderCustomFields,
    archiveCustomField,
    createDesignation,
    reorderDesignations,
    archiveDesignation,
  };
}

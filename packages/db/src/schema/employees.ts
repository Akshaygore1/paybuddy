import { relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { institutions } from "./institutions";

export const employeeDesignations = sqliteTable(
  "employee_designations",
  {
    id: text("id").primaryKey(),
    institutionId: text("institution_id")
      .notNull()
      .references(() => institutions.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    isActive: integer("is_active", { mode: "boolean" }).default(true).notNull(),
    sortOrder: integer("sort_order").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("employee_designations_institution_id_idx").on(table.institutionId)],
);

export const employeeCustomFieldDefinitions = sqliteTable(
  "employee_custom_field_definitions",
  {
    id: text("id").primaryKey(),
    institutionId: text("institution_id")
      .notNull()
      .references(() => institutions.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    key: text("key").notNull(),
    isRequired: integer("is_required", { mode: "boolean" }).default(false).notNull(),
    isActive: integer("is_active", { mode: "boolean" }).default(true).notNull(),
    sortOrder: integer("sort_order").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("employee_custom_field_definitions_institution_id_idx").on(table.institutionId),
    uniqueIndex("employee_custom_field_definitions_institution_key_unique").on(
      table.institutionId,
      table.key,
    ),
  ],
);

export const employees = sqliteTable(
  "employees",
  {
    id: text("id").primaryKey(),
    institutionId: text("institution_id")
      .notNull()
      .references(() => institutions.id, { onDelete: "cascade" }),
    fullName: text("full_name").notNull(),
    designationId: text("designation_id")
      .notNull()
      .references(() => employeeDesignations.id, { onDelete: "restrict" }),
    seniorityRank: integer("seniority_rank").notNull(),
    panNumber: text("pan_number"),
    pfNumber: text("pf_number"),
    npsAccountNumber: text("nps_account_number"),
    whatsAppNumber: text("whats_app_number"),
    contactNumber: text("contact_number"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("employees_institution_id_idx").on(table.institutionId),
    index("employees_designation_id_idx").on(table.designationId),
  ],
);

export const employeeCustomFieldValues = sqliteTable(
  "employee_custom_field_values",
  {
    id: text("id").primaryKey(),
    employeeId: text("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    fieldDefinitionId: text("field_definition_id")
      .notNull()
      .references(() => employeeCustomFieldDefinitions.id, { onDelete: "cascade" }),
    value: text("value").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("employee_custom_field_values_employee_id_idx").on(table.employeeId),
    index("employee_custom_field_values_field_definition_id_idx").on(table.fieldDefinitionId),
    uniqueIndex("employee_custom_field_values_employee_field_unique").on(
      table.employeeId,
      table.fieldDefinitionId,
    ),
  ],
);

export const employeeDesignationsRelations = relations(
  employeeDesignations,
  ({ one, many }) => ({
    institution: one(institutions, {
      fields: [employeeDesignations.institutionId],
      references: [institutions.id],
    }),
    employees: many(employees),
  }),
);

export const employeeCustomFieldDefinitionsRelations = relations(
  employeeCustomFieldDefinitions,
  ({ one, many }) => ({
    institution: one(institutions, {
      fields: [employeeCustomFieldDefinitions.institutionId],
      references: [institutions.id],
    }),
    values: many(employeeCustomFieldValues),
  }),
);

export const employeesRelations = relations(employees, ({ one, many }) => ({
  institution: one(institutions, {
    fields: [employees.institutionId],
    references: [institutions.id],
  }),
  designation: one(employeeDesignations, {
    fields: [employees.designationId],
    references: [employeeDesignations.id],
  }),
  customFieldValues: many(employeeCustomFieldValues),
}));

export const employeeCustomFieldValuesRelations = relations(
  employeeCustomFieldValues,
  ({ one }) => ({
    employee: one(employees, {
      fields: [employeeCustomFieldValues.employeeId],
      references: [employees.id],
    }),
    fieldDefinition: one(employeeCustomFieldDefinitions, {
      fields: [employeeCustomFieldValues.fieldDefinitionId],
      references: [employeeCustomFieldDefinitions.id],
    }),
  }),
);

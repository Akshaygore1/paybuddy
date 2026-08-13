import { relations, sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { employees } from "./employees";
import { institutions } from "./institutions";

export const payrollSectionValues = ["earnings", "deductions"] as const;

export const payrollCustomFieldDefinitions = sqliteTable(
  "payroll_custom_field_definitions",
  {
    id: text("id").primaryKey(),
    institutionId: text("institution_id")
      .notNull()
      .references(() => institutions.id, { onDelete: "cascade" }),
    section: text("section", { enum: payrollSectionValues }).notNull(),
    label: text("label").notNull(),
    key: text("key").notNull(),
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
    index("payroll_custom_field_definitions_institution_id_idx").on(table.institutionId),
    uniqueIndex("payroll_custom_field_definitions_institution_key_unique").on(
      table.institutionId,
      table.key,
    ),
    check(
      "payroll_custom_field_definitions_section_check",
      sql`${table.section} IN ('earnings', 'deductions')`,
    ),
  ],
);

export const payrollCustomFieldPeriods = sqliteTable(
  "payroll_custom_field_periods",
  {
    id: text("id").primaryKey(),
    customFieldDefinitionId: text("custom_field_definition_id")
      .notNull()
      .references(() => payrollCustomFieldDefinitions.id, {
        onDelete: "cascade",
      }),
    effectiveFromMonth: text("effective_from_month").notNull(),
    effectiveToMonth: text("effective_to_month"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("payroll_custom_field_periods_definition_id_idx").on(table.customFieldDefinitionId),
    uniqueIndex("payroll_custom_field_periods_definition_from_unique").on(
      table.customFieldDefinitionId,
      table.effectiveFromMonth,
    ),
    check(
      "payroll_custom_field_periods_from_month_check",
      sql`${table.effectiveFromMonth} GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]'`,
    ),
    check(
      "payroll_custom_field_periods_to_month_check",
      sql`${table.effectiveToMonth} IS NULL OR ${table.effectiveToMonth} GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]'`,
    ),
    check(
      "payroll_custom_field_periods_range_check",
      sql`${table.effectiveToMonth} IS NULL OR ${table.effectiveToMonth} > ${table.effectiveFromMonth}`,
    ),
  ],
);

export const employeePayrollProfiles = sqliteTable(
  "employee_payroll_profiles",
  {
    id: text("id").primaryKey(),
    institutionId: text("institution_id")
      .notNull()
      .references(() => institutions.id, { onDelete: "cascade" }),
    employeeId: text("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    financialYearStart: integer("financial_year_start").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("employee_payroll_profiles_institution_id_idx").on(table.institutionId),
    index("employee_payroll_profiles_employee_id_idx").on(table.employeeId),
    uniqueIndex("employee_payroll_profiles_employee_fy_unique").on(
      table.employeeId,
      table.financialYearStart,
    ),
    check(
      "employee_payroll_profiles_financial_year_start_check",
      sql`${table.financialYearStart} BETWEEN 2023 AND 2028`,
    ),
  ],
);

export const employeePayrollVersions = sqliteTable(
  "employee_payroll_versions",
  {
    id: text("id").primaryKey(),
    payrollProfileId: text("payroll_profile_id")
      .notNull()
      .references(() => employeePayrollProfiles.id, { onDelete: "cascade" }),
    effectiveMonth: text("effective_month").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("employee_payroll_versions_profile_id_idx").on(table.payrollProfileId),
    uniqueIndex("employee_payroll_versions_profile_month_unique").on(
      table.payrollProfileId,
      table.effectiveMonth,
    ),
    check(
      "employee_payroll_versions_effective_month_check",
      sql`${table.effectiveMonth} GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]'`,
    ),
  ],
);

export const payrollLineItems = sqliteTable(
  "payroll_line_items",
  {
    id: text("id").primaryKey(),
    payrollVersionId: text("payroll_version_id")
      .notNull()
      .references(() => employeePayrollVersions.id, { onDelete: "cascade" }),
    section: text("section", { enum: payrollSectionValues }).notNull(),
    fixedFieldKey: text("fixed_field_key"),
    customFieldDefinitionId: text("custom_field_definition_id").references(
      () => payrollCustomFieldDefinitions.id,
      { onDelete: "restrict" },
    ),
    label: text("label").notNull(),
    amountPaise: integer("amount_paise").notNull(),
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
    index("payroll_line_items_version_id_idx").on(table.payrollVersionId),
    index("payroll_line_items_custom_field_definition_id_idx").on(table.customFieldDefinitionId),
    check("payroll_line_items_section_check", sql`${table.section} IN ('earnings', 'deductions')`),
    check("payroll_line_items_amount_paise_check", sql`${table.amountPaise} >= 0`),
    check(
      "payroll_line_items_source_check",
      sql`(${table.fixedFieldKey} IS NOT NULL AND ${table.customFieldDefinitionId} IS NULL) OR (${table.fixedFieldKey} IS NULL AND ${table.customFieldDefinitionId} IS NOT NULL)`,
    ),
  ],
);

export const payrollCustomFieldDefinitionsRelations = relations(
  payrollCustomFieldDefinitions,
  ({ one, many }) => ({
    institution: one(institutions, {
      fields: [payrollCustomFieldDefinitions.institutionId],
      references: [institutions.id],
    }),
    periods: many(payrollCustomFieldPeriods),
    lineItems: many(payrollLineItems),
  }),
);

export const payrollCustomFieldPeriodsRelations = relations(
  payrollCustomFieldPeriods,
  ({ one }) => ({
    customFieldDefinition: one(payrollCustomFieldDefinitions, {
      fields: [payrollCustomFieldPeriods.customFieldDefinitionId],
      references: [payrollCustomFieldDefinitions.id],
    }),
  }),
);

export const employeePayrollProfilesRelations = relations(
  employeePayrollProfiles,
  ({ one, many }) => ({
    institution: one(institutions, {
      fields: [employeePayrollProfiles.institutionId],
      references: [institutions.id],
    }),
    employee: one(employees, {
      fields: [employeePayrollProfiles.employeeId],
      references: [employees.id],
    }),
    versions: many(employeePayrollVersions),
  }),
);

export const employeePayrollVersionsRelations = relations(
  employeePayrollVersions,
  ({ one, many }) => ({
    payrollProfile: one(employeePayrollProfiles, {
      fields: [employeePayrollVersions.payrollProfileId],
      references: [employeePayrollProfiles.id],
    }),
    lineItems: many(payrollLineItems),
  }),
);

export const payrollLineItemsRelations = relations(payrollLineItems, ({ one }) => ({
  payrollVersion: one(employeePayrollVersions, {
    fields: [payrollLineItems.payrollVersionId],
    references: [employeePayrollVersions.id],
  }),
  customFieldDefinition: one(payrollCustomFieldDefinitions, {
    fields: [payrollLineItems.customFieldDefinitionId],
    references: [payrollCustomFieldDefinitions.id],
  }),
}));

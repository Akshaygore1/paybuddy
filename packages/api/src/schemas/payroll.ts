import { z } from "zod";

import {
  containsPayrollMonth,
  isPayrollFinancialYearStart,
  payrollFinancialYearStartValues,
} from "../payroll-financial-year";

export { payrollFinancialYearStartValues as financialYearStartValues };
export const payrollSectionValues = ["earnings", "deductions"] as const;

const requiredTextSchema = z.string().trim().min(1, "This field is required");

export const financialYearStartSchema = z.object({
  financialYearStart: z.coerce
    .number()
    .int("Financial year must be a whole year")
    .refine(isPayrollFinancialYearStart, "Please select a valid financial year"),
});

const payrollMonthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Please select a valid payroll month");

export const payrollPeriodSchema = financialYearStartSchema
  .extend({
    month: payrollMonthSchema,
  })
  .refine(({ financialYearStart, month }) => containsPayrollMonth(financialYearStart, month), {
    path: ["month"],
    message: "Month must belong to the financial year",
  });

export const payrollEmployeeFormSchema = payrollPeriodSchema.safeExtend({
  employeeId: requiredTextSchema,
});

export const payrollSectionSchema = z.enum(payrollSectionValues);

export const payrollMoneyInputSchema = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, "Enter a valid non-negative amount");

export const payrollLineItemPayloadSchema = z.object({
  section: payrollSectionSchema,
  fixedFieldKey: z.string().trim().min(1).nullable().optional(),
  customFieldDefinitionId: z.string().trim().min(1).nullable().optional(),
  amount: payrollMoneyInputSchema,
});

export const savePayrollSchema = payrollEmployeeFormSchema.extend({
  lineItems: z.array(payrollLineItemPayloadSchema),
});

export const addPayrollCustomFieldSchema = payrollPeriodSchema.safeExtend({
  section: payrollSectionSchema,
  label: requiredTextSchema.max(120, "Field label is too long"),
});

export const archivePayrollCustomFieldSchema = payrollPeriodSchema.safeExtend({
  id: requiredTextSchema,
});

export const adminArchivePayrollCustomFieldSchema = archivePayrollCustomFieldSchema.extend({
  institutionId: requiredTextSchema,
});

export const getAdminPayrollCustomFieldsSchema = z.object({
  institutionId: requiredTextSchema,
});

export type SavePayrollInput = z.infer<typeof savePayrollSchema>;
export type AddPayrollCustomFieldInput = z.infer<typeof addPayrollCustomFieldSchema>;

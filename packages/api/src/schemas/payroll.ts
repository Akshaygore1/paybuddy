import { z } from "zod";

export const financialYearStartValues = [2023, 2024, 2025, 2026, 2027, 2028] as const;
export const payrollSectionValues = ["earnings", "deductions"] as const;

const requiredTextSchema = z.string().trim().min(1, "This field is required");

export const financialYearStartSchema = z.object({
  financialYearStart: z.coerce
    .number()
    .int("Financial year must be a whole year")
    .refine(
      (value): value is (typeof financialYearStartValues)[number] =>
        financialYearStartValues.includes(value as (typeof financialYearStartValues)[number]),
      "Please select a valid financial year",
    ),
});

const payrollMonthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Please select a valid payroll month");

export const payrollPeriodSchema = financialYearStartSchema
  .extend({
    month: payrollMonthSchema,
  })
  .refine(
    ({ financialYearStart, month }) => {
      const [yearText, monthText] = month.split("-");
      const year = Number(yearText);
      const monthNumber = Number(monthText);

      return (
        (year === financialYearStart && monthNumber >= 4) ||
        (year === financialYearStart + 1 && monthNumber <= 3)
      );
    },
    { path: ["month"], message: "Month must belong to the financial year" },
  );

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

export type SavePayrollInput = z.infer<typeof savePayrollSchema>;
export type AddPayrollCustomFieldInput = z.infer<typeof addPayrollCustomFieldSchema>;

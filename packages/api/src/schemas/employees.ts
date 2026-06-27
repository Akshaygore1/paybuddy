import { z } from "zod";

export const employeeGenderValues = ["Male", "Female"] as const;

export const defaultEmployeeFieldDefinitions = [
  {
    key: "fullName",
    label: "Full name",
    isRequired: true,
  },
  {
    key: "designationId",
    label: "Designation",
    isRequired: true,
  },
  {
    key: "dateOfBirth",
    label: "Date of birth",
    isRequired: true,
  },
  {
    key: "gender",
    label: "Gender",
    isRequired: true,
  },
  {
    key: "seniorityRank",
    label: "Seniority rank",
    isRequired: true,
  },
  {
    key: "panNumber",
    label: "PAN number",
    isRequired: false,
  },
  {
    key: "pfNumber",
    label: "PF number",
    isRequired: false,
  },
  {
    key: "npsAccountNumber",
    label: "NPS account number",
    isRequired: false,
  },
  {
    key: "whatsAppNumber",
    label: "WhatsApp number",
    isRequired: false,
  },
  {
    key: "contactNumber",
    label: "Contact number",
    isRequired: false,
  },
] as const;

const requiredTextSchema = z.string().trim().min(1, "This field is required");
const optionalTextSchema = z.string().trim().max(255).optional().default("");
const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateOnly(value: string) {
  if (!dateOnlyPattern.test(value)) {
    return false;
  }

  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    Number.isFinite(date.getTime()) &&
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export const createDesignationSchema = z.object({
  name: requiredTextSchema.max(120, "Designation name is too long"),
});

export const reorderEntitySchema = z.object({
  orderedIds: z.array(requiredTextSchema).min(1, "At least one item is required"),
});

export const archiveEntitySchema = z.object({
  id: requiredTextSchema,
});

export const addCustomFieldSchema = z.object({
  label: requiredTextSchema.max(120, "Field label is too long"),
  isRequired: z.boolean().default(false),
});

export const createEmployeeSchema = z.object({
  firstName: requiredTextSchema.max(160, "First name is too long"),
  middleName: requiredTextSchema.max(160, "Middle name is too long"),
  surname: requiredTextSchema.max(160, "Surname is too long"),
  dateOfBirth: requiredTextSchema.refine(isValidDateOnly, {
    message: "Date of birth must be a valid date",
  }),
  gender: z.enum(employeeGenderValues, {
    error: "Please select a valid gender",
  }),
  designationId: requiredTextSchema,
  seniorityRank: z.coerce
    .number()
    .int("Seniority rank must be a whole number")
    .positive("Seniority rank must be greater than zero"),
  panNumber: optionalTextSchema,
  pfNumber: optionalTextSchema,
  npsAccountNumber: optionalTextSchema,
  whatsAppNumber: optionalTextSchema,
  contactNumber: optionalTextSchema,
  customFieldValues: z.record(z.string(), z.string().trim().max(1000)).default({}),
});

export const employeeIdSchema = z.object({
  employeeId: requiredTextSchema,
});

export const updateEmployeeSchema = createEmployeeSchema.extend({
  employeeId: requiredTextSchema,
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;

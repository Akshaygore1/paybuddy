import { z } from "zod";

const emailLikeUsernameSchema = z.email("Enter a valid email address");
const handleLikeUsernameSchema = z
  .string()
  .trim()
  .min(3, "Username must be at least 3 characters")
  .max(30, "Username must be at most 30 characters")
  .regex(/^[a-zA-Z0-9_.]+$/, "Username can only contain letters, numbers, underscores, and periods");

function isValidInstitutionUsername(value: string) {
  return (
    emailLikeUsernameSchema.safeParse(value).success ||
    handleLikeUsernameSchema.safeParse(value).success
  );
}

export const createInstitutionStep1Schema = z.object({
  name: z.string().trim().min(1, "Institution name is required"),
  tanNumber: z
    .string()
    .trim()
    .min(1, "TAN number is required")
    .max(64, "TAN number is too long"),
  institutionHead: z.string().trim().min(1, "Institution head is required"),
  address: z.string().trim().min(1, "Address is required"),
});

export const createInstitutionStep2Schema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters")
    .max(254, "Username must be at most 254 characters")
    .refine(
      isValidInstitutionUsername,
      "Username must be a valid email address or use only letters, numbers, underscores, and periods",
    ),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const createInstitutionSchema = createInstitutionStep1Schema.extend(
  createInstitutionStep2Schema.shape,
);

export const resetInstitutionPasswordSchema = z.object({
  institutionId: z.string().trim().min(1, "Institution ID is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const deactivateInstitutionLoginSchema = z.object({
  institutionId: z.string().trim().min(1, "Institution ID is required"),
});

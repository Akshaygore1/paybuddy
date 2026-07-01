import { z } from "zod";

import { financialYearStartSchema } from "./payroll";

export const reportInputSchema = financialYearStartSchema.extend({
  institutionId: z.string().trim().min(1).optional(),
});

export type ReportInput = z.infer<typeof reportInputSchema>;

import { z } from "zod";

import { buildInstitutionAccountModule } from "../modules/institution-accounts";
import { adminProcedure, router } from "../index";
import {
  createInstitutionSchema,
  setInstitutionLoginAccessSchema,
  resetInstitutionPasswordSchema,
} from "../schemas/institutions";

const institutionAccounts = buildInstitutionAccountModule();

const institutionIdSchema = z.object({
  institutionId: z.string().trim().min(1, "Institution ID is required"),
});

export const institutionsRouter = router({
  list: adminProcedure.query(async () => {
    return institutionAccounts.list();
  }),
  getById: adminProcedure.input(institutionIdSchema).query(async ({ input }) => {
    return institutionAccounts.getById(input.institutionId);
  }),
  create: adminProcedure.input(createInstitutionSchema).mutation(async ({ ctx, input }) => {
    return institutionAccounts.create(input, ctx.headers);
  }),
  resetPassword: adminProcedure
    .input(resetInstitutionPasswordSchema)
    .mutation(async ({ ctx, input }) => {
      return institutionAccounts.resetPassword(input, ctx.headers);
    }),
  setLoginAccess: adminProcedure
    .input(setInstitutionLoginAccessSchema)
    .mutation(async ({ ctx, input }) => {
      return institutionAccounts.setLoginAccess(input, ctx.headers);
    }),
});

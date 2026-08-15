import { createDb } from "@tds-nivaran/db";
import { institutions } from "@tds-nivaran/db/schema/index";
import { eq } from "drizzle-orm";

import { buildPayrollModule } from "../modules/payroll";
import {
  addPayrollCustomFieldSchema,
  adminArchivePayrollCustomFieldSchema,
  archivePayrollCustomFieldSchema,
  getAdminPayrollCustomFieldsSchema,
  payrollEmployeeFormSchema,
  savePayrollSchema,
} from "../schemas/payroll";
import { adminProcedure, institutionProcedure, protectedProcedure, router } from "../index";

const db = createDb();
const payroll = buildPayrollModule();

export const payrollRouter = router({
  getEmployees: institutionProcedure.query(async ({ ctx }) => {
    return payroll.getEmployees(ctx.institution.id);
  }),
  getForm: institutionProcedure.input(payrollEmployeeFormSchema).query(async ({ ctx, input }) => {
    return payroll.getForm(
      ctx.institution.id,
      input.employeeId,
      input.financialYearStart,
      input.month,
    );
  }),
  save: institutionProcedure.input(savePayrollSchema).mutation(async ({ ctx, input }) => {
    return payroll.save(ctx.institution.id, input);
  }),
  addCustomField: institutionProcedure
    .input(addPayrollCustomFieldSchema)
    .mutation(async ({ ctx, input }) => {
      return payroll.addCustomField(ctx.institution.id, input);
    }),
  archiveCustomField: protectedProcedure
    .input(archivePayrollCustomFieldSchema)
    .mutation(async ({ ctx, input }) => {
      if (ctx.session.user.role !== "admin") {
        throw new Error("Only admin can delete payroll custom fields");
      }
      const institution = await db
        .select({ id: institutions.id })
        .from(institutions)
        .where(eq(institutions.userId, ctx.session.user.id))
        .get();

      if (!institution) {
        throw new Error("Institution not found");
      }

      return payroll.archiveCustomField(institution.id, input);
    }),
  getAdminCustomFields: adminProcedure
    .input(getAdminPayrollCustomFieldsSchema)
    .query(async ({ input }) => {
      return payroll.getCustomFields(input.institutionId);
    }),
  adminArchiveCustomField: adminProcedure
    .input(adminArchivePayrollCustomFieldSchema)
    .mutation(async ({ input }) => {
      const { institutionId, ...restInput } = input;
      return payroll.archiveCustomField(institutionId, restInput);
    }),
});


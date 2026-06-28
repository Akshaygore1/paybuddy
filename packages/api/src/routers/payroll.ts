import { buildPayrollModule } from "../modules/payroll";
import {
  addPayrollCustomFieldSchema,
  archivePayrollCustomFieldSchema,
  payrollEmployeeFormSchema,
  savePayrollSchema,
} from "../schemas/payroll";
import { institutionProcedure, router } from "../index";

const payroll = buildPayrollModule();

export const payrollRouter = router({
  getEmployees: institutionProcedure.query(async ({ ctx }) => {
    return payroll.getEmployees(ctx.institution.id);
  }),
  getForm: institutionProcedure
    .input(payrollEmployeeFormSchema)
    .query(async ({ ctx, input }) => {
      return payroll.getForm(
        ctx.institution.id,
        input.employeeId,
        input.financialYearStart,
      );
    }),
  save: institutionProcedure
    .input(savePayrollSchema)
    .mutation(async ({ ctx, input }) => {
      return payroll.save(ctx.institution.id, input);
    }),
  addCustomField: institutionProcedure
    .input(addPayrollCustomFieldSchema)
    .mutation(async ({ ctx, input }) => {
      return payroll.addCustomField(ctx.institution.id, input);
    }),
  archiveCustomField: institutionProcedure
    .input(archivePayrollCustomFieldSchema)
    .mutation(async ({ ctx, input }) => {
      return payroll.archiveCustomField(ctx.institution.id, input.id);
    }),
});

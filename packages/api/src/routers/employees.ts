import { buildEmployeeRecordsModule } from "../modules/employee-records";
import {
  createEmployeeSchema,
  employeeIdSchema,
  updateEmployeeSchema,
} from "../schemas/employees";
import { institutionProcedure, router } from "../index";

const employeeRecords = buildEmployeeRecordsModule();

export const employeesRouter = router({
  getDirectory: institutionProcedure.query(async ({ ctx }) => {
    return employeeRecords.getDirectory(ctx.institution.id);
  }),
  getCreateForm: institutionProcedure.query(async ({ ctx }) => {
    return employeeRecords.getCreateForm(ctx.institution.id);
  }),
  getEditForm: institutionProcedure.input(employeeIdSchema).query(async ({ ctx, input }) => {
    return employeeRecords.getEditForm(ctx.institution.id, input.employeeId);
  }),
  create: institutionProcedure.input(createEmployeeSchema).mutation(async ({ ctx, input }) => {
    return employeeRecords.createEmployee(ctx.institution.id, input);
  }),
  update: institutionProcedure.input(updateEmployeeSchema).mutation(async ({ ctx, input }) => {
    return employeeRecords.updateEmployee(ctx.institution.id, input);
  }),
  delete: institutionProcedure.input(employeeIdSchema).mutation(async ({ ctx, input }) => {
    return employeeRecords.deleteEmployee(ctx.institution.id, input.employeeId);
  }),
});

import { buildEmployeeSetupModule } from "../modules/employee-setup";
import {
  addCustomFieldSchema,
  archiveEntitySchema,
  createDesignationSchema,
  reorderEntitySchema,
} from "../schemas/employees";
import { institutionProcedure, router } from "../index";

const employeeSetup = buildEmployeeSetupModule();

export const employeeSettingsRouter = router({
  getFormConfig: institutionProcedure.query(async ({ ctx }) => {
    return employeeSetup.getSetupDefinition(ctx.institution.id);
  }),
  addCustomField: institutionProcedure
    .input(addCustomFieldSchema)
    .mutation(async ({ ctx, input }) => {
      return employeeSetup.addCustomField(ctx.institution.id, input);
    }),
  reorderCustomFields: institutionProcedure
    .input(reorderEntitySchema)
    .mutation(async ({ ctx, input }) => {
      return employeeSetup.reorderCustomFields(ctx.institution.id, input);
    }),
  archiveCustomField: institutionProcedure
    .input(archiveEntitySchema)
    .mutation(async ({ ctx, input }) => {
      return employeeSetup.archiveCustomField(ctx.institution.id, input);
    }),
  createDesignation: institutionProcedure
    .input(createDesignationSchema)
    .mutation(async ({ ctx, input }) => {
      return employeeSetup.createDesignation(ctx.institution.id, input);
    }),
  reorderDesignations: institutionProcedure
    .input(reorderEntitySchema)
    .mutation(async ({ ctx, input }) => {
      return employeeSetup.reorderDesignations(ctx.institution.id, input);
    }),
  archiveDesignation: institutionProcedure
    .input(archiveEntitySchema)
    .mutation(async ({ ctx, input }) => {
      return employeeSetup.archiveDesignation(ctx.institution.id, input);
    }),
});

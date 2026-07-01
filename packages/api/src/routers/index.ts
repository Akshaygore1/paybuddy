import { protectedProcedure, publicProcedure, router } from "../index";
import { employeeSettingsRouter } from "./employee-settings";
import { employeesRouter } from "./employees";
import { institutionsRouter } from "./institutions";
import { payrollRouter } from "./payroll";
import { reportsRouter } from "./reports";

export const appRouter = router({
  healthCheck: publicProcedure.query(() => {
    return "OK";
  }),
  privateData: protectedProcedure.query(({ ctx }) => {
    return {
      message: "This is private",
      user: ctx.session.user,
    };
  }),
  employeeSettings: employeeSettingsRouter,
  employees: employeesRouter,
  institutions: institutionsRouter,
  payroll: payrollRouter,
  reports: reportsRouter,
});
export type AppRouter = typeof appRouter;

import { buildReportsModule } from "../modules/reports";
import { protectedProcedure, router } from "../index";
import { reportInputSchema } from "../schemas/reports";

const reports = buildReportsModule();

export const reportsRouter = router({
  getReport: protectedProcedure
    .input(reportInputSchema)
    .query(async ({ ctx, input }) => {
      return reports.getReport(input, {
        id: ctx.session.user.id,
        role: ctx.session.user.role,
      });
    }),
});

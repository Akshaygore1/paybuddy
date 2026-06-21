import { protectedProcedure, publicProcedure, router } from "../index";
import { institutionsRouter } from "./institutions";

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
  institutions: institutionsRouter,
});
export type AppRouter = typeof appRouter;

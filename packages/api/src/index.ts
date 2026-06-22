import { initTRPC, TRPCError } from "@trpc/server";
import type { UserRole } from "@paybuddy/auth";
import { createDb } from "@paybuddy/db";
import { institutions } from "@paybuddy/db/schema/index";
import { eq } from "drizzle-orm";

import type { Context } from "./context";

export const t = initTRPC.context<Context>().create();
const db = createDb();

export const router = t.router;

export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required",
      cause: "No session",
    });
  }
  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
    },
  });
});

export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.session.user.role !== "admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Admin role required",
    });
  }

  return next({
    ctx: {
      ...ctx,
      session: ctx.session as typeof ctx.session & {
        user: typeof ctx.session.user & { role: Extract<UserRole, "admin"> };
      },
    },
  });
});

export const userProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.session.user.role !== "user") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Institution user role required",
    });
  }

  return next({
    ctx: {
      ...ctx,
      session: ctx.session as typeof ctx.session & {
        user: typeof ctx.session.user & { role: Extract<UserRole, "user"> };
      },
    },
  });
});

export const institutionProcedure = userProcedure.use(async ({ ctx, next }) => {
  const institution = await db
    .select({
      id: institutions.id,
      userId: institutions.userId,
      name: institutions.name,
      loginActive: institutions.loginActive,
    })
    .from(institutions)
    .where(eq(institutions.userId, ctx.session.user.id))
    .get();

  if (!institution) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Institution account not found for this user",
    });
  }

  return next({
    ctx: {
      ...ctx,
      institution,
    },
  });
});

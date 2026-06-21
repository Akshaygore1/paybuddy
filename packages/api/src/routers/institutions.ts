import { createAuth } from "@paybuddy/auth";
import { createDb } from "@paybuddy/db";
import { institutions, user } from "@paybuddy/db/schema/index";
import { and, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { adminProcedure, router } from "../index";
import {
  createInstitutionSchema,
  resetInstitutionPasswordSchema,
} from "../schemas/institutions";

const auth = createAuth();
const db = createDb();

const institutionIdSchema = z.object({
  institutionId: z.string().trim().min(1, "Institution ID is required"),
});

function buildInstitutionEmail(username: string) {
  if (z.email().safeParse(username).success) {
    return username.toLowerCase();
  }

  return `${username.toLowerCase()}@institution.paybuddy.local`;
}

type BetterAuthLikeError = {
  message?: string;
  statusCode?: number;
};

function isBetterAuthLikeError(error: unknown): error is BetterAuthLikeError {
  return typeof error === "object" && error !== null && "statusCode" in error;
}

function normalizeApiError(error: unknown, fallbackMessage: string): never {
  if (isBetterAuthLikeError(error)) {
    throw new TRPCError({
      code:
        error.statusCode === 401
          ? "UNAUTHORIZED"
          : error.statusCode === 403
            ? "FORBIDDEN"
            : error.statusCode === 404
              ? "NOT_FOUND"
              : error.statusCode === 409
                ? "CONFLICT"
                : "BAD_REQUEST",
      message: error.message || fallbackMessage,
    });
  }

  throw error;
}

export const institutionsRouter = router({
  list: adminProcedure.query(async () => {
    const rows = await db
      .select({
        id: institutions.id,
        userId: institutions.userId,
        name: institutions.name,
        tanNumber: institutions.tanNumber,
        institutionHead: institutions.institutionHead,
        address: institutions.address,
        loginActive: institutions.loginActive,
        createdAt: institutions.createdAt,
        updatedAt: institutions.updatedAt,
        username: user.username,
      })
      .from(institutions)
      .innerJoin(user, eq(user.id, institutions.userId))
      .orderBy(desc(institutions.createdAt));

    return rows;
  }),
  getById: adminProcedure.input(institutionIdSchema).query(async ({ input }) => {
    const row = await db
      .select({
        id: institutions.id,
        userId: institutions.userId,
        name: institutions.name,
        tanNumber: institutions.tanNumber,
        institutionHead: institutions.institutionHead,
        address: institutions.address,
        loginActive: institutions.loginActive,
        createdAt: institutions.createdAt,
        updatedAt: institutions.updatedAt,
        username: user.username,
        userName: user.name,
        email: user.email,
        banned: user.banned,
      })
      .from(institutions)
      .innerJoin(user, eq(user.id, institutions.userId))
      .where(eq(institutions.id, input.institutionId))
      .get();

    if (!row) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Institution not found",
      });
    }

    return row;
  }),
  create: adminProcedure.input(createInstitutionSchema).mutation(async ({ ctx, input }) => {
    const existingInstitution = await db
      .select({ id: institutions.id })
      .from(institutions)
      .where(eq(institutions.tanNumber, input.tanNumber))
      .get();

    if (existingInstitution) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "An institution with this TAN number already exists",
      });
    }

    let createdUserId: string | null = null;

    try {
      const result = await auth.api.createUser({
        headers: ctx.headers,
        body: {
          email: buildInstitutionEmail(input.username),
          name: input.name,
          password: input.password,
          role: "user",
          data: {
            username: input.username,
            displayUsername: input.username,
          },
        },
      });

      createdUserId = result.user.id;

      const [createdInstitution] = await db
        .insert(institutions)
        .values({
          id: crypto.randomUUID(),
          userId: result.user.id,
          name: input.name,
          tanNumber: input.tanNumber,
          institutionHead: input.institutionHead,
          address: input.address,
          loginActive: true,
        })
        .returning();

      return createdInstitution;
    } catch (error) {
      if (createdUserId) {
        await db.delete(user).where(eq(user.id, createdUserId));
      }

      normalizeApiError(error, "Unable to create institution");
    }
  }),
  resetPassword: adminProcedure
    .input(resetInstitutionPasswordSchema)
    .mutation(async ({ ctx, input }) => {
      const institution = await db
        .select({
          id: institutions.id,
          userId: institutions.userId,
        })
        .from(institutions)
        .where(eq(institutions.id, input.institutionId))
        .get();

      if (!institution) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Institution not found",
        });
      }

      try {
        await auth.api.setUserPassword({
          headers: ctx.headers,
          body: {
            userId: institution.userId,
            newPassword: input.password,
          },
        });
      } catch (error) {
        normalizeApiError(error, "Unable to reset password");
      }

      return { success: true };
    }),
  deactivateLogin: adminProcedure
    .input(institutionIdSchema)
    .mutation(async ({ ctx, input }) => {
      const institution = await db
        .select({
          id: institutions.id,
          userId: institutions.userId,
          loginActive: institutions.loginActive,
        })
        .from(institutions)
        .where(eq(institutions.id, input.institutionId))
        .get();

      if (!institution) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Institution not found",
        });
      }

      if (!institution.loginActive) {
        return { success: true };
      }

      try {
        await auth.api.banUser({
          headers: ctx.headers,
          body: {
            userId: institution.userId,
            banReason: "Institution login has been deactivated",
          },
        });
      } catch (error) {
        normalizeApiError(error, "Unable to deactivate institution login");
      }

      await db
        .update(institutions)
        .set({
          loginActive: false,
        })
        .where(and(eq(institutions.id, input.institutionId), eq(institutions.userId, institution.userId)));

      return { success: true };
    }),
});

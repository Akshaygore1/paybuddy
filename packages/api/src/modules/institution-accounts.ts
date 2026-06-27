import { createAuth } from "@paybuddy/auth";
import { createDb } from "@paybuddy/db";
import { institutions, user } from "@paybuddy/db/schema/index";
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import type { z } from "zod";

import type {
  createInstitutionSchema,
  deactivateInstitutionLoginSchema,
  resetInstitutionPasswordSchema,
} from "../schemas/institutions";

type Db = ReturnType<typeof createDb>;
type Auth = ReturnType<typeof createAuth>;

type InstitutionAccountModuleOptions = {
  auth?: Auth;
  db?: Db;
};

type RequestHeaders = Headers;

export type InstitutionAccountSummary = {
  id: string;
  userId: string;
  name: string;
  tanNumber: string;
  institutionHead: string;
  address: string;
  loginActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  username: string | null;
};

export type InstitutionAccountDetail = InstitutionAccountSummary & {
  userName: string;
  email: string;
  banned: boolean;
};

export type CreateInstitutionAccountInput = z.infer<typeof createInstitutionSchema>;
export type ResetInstitutionPasswordInput = z.infer<typeof resetInstitutionPasswordSchema>;
export type DeactivateInstitutionLoginInput = z.infer<typeof deactivateInstitutionLoginSchema>;

type BetterAuthLikeError = {
  message?: string;
  statusCode?: number;
};

function isBetterAuthLikeError(error: unknown): error is BetterAuthLikeError {
  return typeof error === "object" && error !== null && "statusCode" in error;
}

export function buildInstitutionEmail(username: string) {
  const normalizedUsername = username.trim().toLowerCase();

  if (normalizedUsername.includes("@")) {
    return normalizedUsername;
  }

  return `${normalizedUsername}@institution.paybuddy.local`;
}

export function normalizeBetterAuthError(error: unknown, fallbackMessage: string): never {
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

export function buildInstitutionAccountModule(options: InstitutionAccountModuleOptions = {}) {
  const auth = options.auth ?? createAuth();
  const db = options.db ?? createDb();

  async function list(): Promise<InstitutionAccountSummary[]> {
    return db
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
  }

  async function getById(institutionId: string): Promise<InstitutionAccountDetail> {
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
      .where(eq(institutions.id, institutionId))
      .get();

    if (!row) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Institution not found",
      });
    }

    return row;
  }

  async function create(input: CreateInstitutionAccountInput, headers: RequestHeaders) {
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
        headers,
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

      normalizeBetterAuthError(error, "Unable to create institution");
    }
  }

  async function resetPassword(input: ResetInstitutionPasswordInput, headers: RequestHeaders) {
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
        headers,
        body: {
          userId: institution.userId,
          newPassword: input.password,
        },
      });
    } catch (error) {
      normalizeBetterAuthError(error, "Unable to reset password");
    }

    return { success: true };
  }

  async function deactivateLogin(input: DeactivateInstitutionLoginInput, headers: RequestHeaders) {
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
        headers,
        body: {
          userId: institution.userId,
          banReason: "Institution login has been deactivated",
        },
      });
    } catch (error) {
      normalizeBetterAuthError(error, "Unable to deactivate institution login");
    }

    await db
      .update(institutions)
      .set({ loginActive: false })
      .where(and(eq(institutions.id, input.institutionId), eq(institutions.userId, institution.userId)));

    return { success: true };
  }

  return {
    list,
    getById,
    create,
    resetPassword,
    deactivateLogin,
  };
}

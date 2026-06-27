import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";

import {
  buildInstitutionAccountModule,
  buildInstitutionEmail,
  normalizeBetterAuthError,
} from "./institution-accounts";

describe("Institution account login email normalization", () => {
  it("preserves real emails", () => {
    expect(buildInstitutionEmail("Admin@School.edu")).toBe("admin@school.edu");
  });

  it("generates local emails for handles", () => {
    expect(buildInstitutionEmail(" school_admin ")).toBe(
      "school_admin@institution.paybuddy.local",
    );
  });
});

describe("Institution account Better Auth errors", () => {
  it("maps Better Auth conflicts to tRPC conflicts", () => {
    try {
      normalizeBetterAuthError({ statusCode: 409, message: "User exists" }, "Fallback");
    } catch (error) {
      expect(error).toBeInstanceOf(TRPCError);
      expect((error as TRPCError).code).toBe("CONFLICT");
      expect((error as TRPCError).message).toBe("User exists");
    }
  });

  it("maps unknown Better Auth status codes to bad requests", () => {
    try {
      normalizeBetterAuthError({ statusCode: 422 }, "Fallback");
    } catch (error) {
      expect(error).toBeInstanceOf(TRPCError);
      expect((error as TRPCError).code).toBe("BAD_REQUEST");
      expect((error as TRPCError).message).toBe("Fallback");
    }
  });
});

describe("Institution account workflows", () => {
  const headers = new Headers();
  const createInput = {
    name: "Springfield School",
    tanNumber: "TAN123",
    institutionHead: "Principal Skinner",
    address: "742 Evergreen Terrace",
    username: "springfield",
    password: "password123",
  };

  it("rolls back the created auth user when Institution insert fails", async () => {
    const deletedUserIds: string[] = [];
    const auth = {
      api: {
        createUser: async () => ({ user: { id: "auth-user-1" } }),
      },
    };
    const db = {
      select: () => ({
        from: () => ({
          where: () => ({
            get: async () => null,
          }),
        }),
      }),
      insert: () => ({
        values: () => ({
          returning: async () => {
            throw new Error("insert failed");
          },
        }),
      }),
      delete: () => ({
        where: () => {
          deletedUserIds.push("auth-user-1");
        },
      }),
    };

    const institutionAccounts = buildInstitutionAccountModule({
      auth: auth as never,
      db: db as never,
    });

    await expect(institutionAccounts.create(createInput, headers)).rejects.toThrow("insert failed");
    expect(deletedUserIds).toEqual(["auth-user-1"]);
  });

  it("deactivates Login Access idempotently when already inactive", async () => {
    let banUserCalled = false;
    let updateCalled = false;
    const auth = {
      api: {
        banUser: async () => {
          banUserCalled = true;
        },
      },
    };
    const db = {
      select: () => ({
        from: () => ({
          where: () => ({
            get: async () => ({
              id: "institution-1",
              userId: "auth-user-1",
              loginActive: false,
            }),
          }),
        }),
      }),
      update: () => {
        updateCalled = true;
        return {
          set: () => ({
            where: () => undefined,
          }),
        };
      },
    };

    const institutionAccounts = buildInstitutionAccountModule({
      auth: auth as never,
      db: db as never,
    });

    await expect(
      institutionAccounts.deactivateLogin({ institutionId: "institution-1" }, headers),
    ).resolves.toEqual({ success: true });
    expect(banUserCalled).toBe(false);
    expect(updateCalled).toBe(false);
  });
});

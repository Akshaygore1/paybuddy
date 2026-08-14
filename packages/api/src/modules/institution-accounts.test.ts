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
      "school_admin@institution.tds-nivaran.local",
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
          innerJoin: () => ({
            where: () => ({
              get: async () => ({
                id: "institution-1",
                userId: "auth-user-1",
                banned: true,
              }),
            }),
          }),
        }),
      }),
    };

    const institutionAccounts = buildInstitutionAccountModule({
      auth: auth as never,
      db: db as never,
    });

    await expect(
      institutionAccounts.setLoginAccess(
        { institutionId: "institution-1", active: false },
        headers,
      ),
    ).resolves.toEqual({ success: true });
    expect(banUserCalled).toBe(false);
  });

  it("re-enables an inactive institution through Better Auth", async () => {
    const unbannedUserIds: string[] = [];
    const auth = {
      api: {
        unbanUser: async ({ body }: { body: { userId: string } }) => {
          unbannedUserIds.push(body.userId);
        },
      },
    };
    const db = {
      select: () => ({
        from: () => ({
          innerJoin: () => ({
            where: () => ({
              get: async () => ({ id: "institution-1", userId: "auth-user-1", banned: true }),
            }),
          }),
        }),
      }),
    };
    const institutionAccounts = buildInstitutionAccountModule({
      auth: auth as never,
      db: db as never,
    });

    await expect(
      institutionAccounts.setLoginAccess({ institutionId: "institution-1", active: true }, headers),
    ).resolves.toEqual({ success: true });
    expect(unbannedUserIds).toEqual(["auth-user-1"]);
  });

  it("disables an active institution through Better Auth so sessions are revoked", async () => {
    const bans: Array<{ userId: string; banReason?: string }> = [];
    const institutionAccounts = buildInstitutionAccountModule({
      auth: {
        api: {
          banUser: async ({ body }: { body: { userId: string; banReason?: string } }) => {
            bans.push(body);
          },
        },
      } as never,
      db: {
        select: () => ({
          from: () => ({
            innerJoin: () => ({
              where: () => ({
                get: async () => ({ id: "institution-1", userId: "auth-user-1", banned: false }),
              }),
            }),
          }),
        }),
      } as never,
    });

    await institutionAccounts.setLoginAccess(
      { institutionId: "institution-1", active: false },
      headers,
    );
    expect(bans).toEqual([
      { userId: "auth-user-1", banReason: "Institution login has been deactivated" },
    ]);
  });

  it("does not call Better Auth when access is already enabled", async () => {
    let unbanCalled = false;
    const institutionAccounts = buildInstitutionAccountModule({
      auth: {
        api: {
          unbanUser: async () => {
            unbanCalled = true;
          },
        },
      } as never,
      db: {
        select: () => ({
          from: () => ({
            innerJoin: () => ({
              where: () => ({
                get: async () => ({ id: "institution-1", userId: "auth-user-1", banned: false }),
              }),
            }),
          }),
        }),
      } as never,
    });

    await institutionAccounts.setLoginAccess(
      { institutionId: "institution-1", active: true },
      headers,
    );
    expect(unbanCalled).toBe(false);
  });

  it("reports missing Institutions before calling Better Auth", async () => {
    const institutionAccounts = buildInstitutionAccountModule({
      auth: { api: {} } as never,
      db: {
        select: () => ({
          from: () => ({
            innerJoin: () => ({ where: () => ({ get: async () => null }) }),
          }),
        }),
      } as never,
    });

    await expect(
      institutionAccounts.setLoginAccess({ institutionId: "missing", active: false }, headers),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("surfaces Better Auth failures without persisting a second access flag", async () => {
    const institutionAccounts = buildInstitutionAccountModule({
      auth: {
        api: {
          banUser: async () => {
            throw { statusCode: 403, message: "Denied" };
          },
        },
      } as never,
      db: {
        select: () => ({
          from: () => ({
            innerJoin: () => ({
              where: () => ({
                get: async () => ({ id: "institution-1", userId: "auth-user-1", banned: false }),
              }),
            }),
          }),
        }),
      } as never,
    });

    await expect(
      institutionAccounts.setLoginAccess(
        { institutionId: "institution-1", active: false },
        headers,
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN", message: "Denied" });
  });
});

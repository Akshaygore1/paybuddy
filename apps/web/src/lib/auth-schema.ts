import type { DBFieldAttribute } from "better-auth";
import { z } from "zod";

export const userRoles = ["admin", "user"] as const;
const userRoleFieldType = ["admin", "user"] as ["admin", "user"];

export type UserRole = (typeof userRoles)[number];

export const authAdditionalUserFields = {
  role: {
    type: userRoleFieldType,
    required: true,
    defaultValue: "user",
    input: false,
    validator: {
      output: z.enum(userRoles),
    },
  },
} satisfies Record<string, DBFieldAttribute>;

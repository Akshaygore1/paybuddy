import type { UserRole } from "./auth-schema";

export function getDefaultRouteForRole(role: UserRole) {
  return role === "admin" ? "/dashboard" : "/employee";
}

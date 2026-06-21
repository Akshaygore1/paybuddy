import type { UserRole } from "./auth-schema";

export function getDefaultRouteForRole(_role: UserRole) {
  return "/dashboard";
}

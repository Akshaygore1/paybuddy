import type { ReactNode } from "react";
import { Navigate } from "react-router";

import { authClient } from "@/lib/auth-client";
import { getDefaultRouteForRole } from "@/lib/auth-routing";

import Loader from "./loader";

type UserRouteGuardProps = {
  children: ReactNode;
};

export function UserRouteGuard({ children }: UserRouteGuardProps) {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return <Loader />;
  }

  if (!session) {
    return <Navigate to="/sign-in" replace />;
  }

  if (session.user.role !== "user") {
    return <Navigate to={getDefaultRouteForRole(session.user.role)} replace />;
  }

  return <>{children}</>;
}

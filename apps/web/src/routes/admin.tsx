import { useQuery } from "@tanstack/react-query";
import { Navigate } from "react-router";

import Loader from "@/components/loader";
import { authClient } from "@/lib/auth-client";
import { getDefaultRouteForRole } from "@/lib/auth-routing";
import { trpc } from "@/utils/trpc";

export default function Admin() {
  const { data: session, isPending } = authClient.useSession();
  const privateData = useQuery({
    ...trpc.privateData.queryOptions(),
    enabled: !!session,
  });

  if (isPending) {
    return <Loader />;
  }

  if (!session) {
    return <Navigate to="/sign-in" replace />;
  }

  if (session.user.role !== "admin") {
    return <Navigate to={getDefaultRouteForRole(session.user.role)} replace />;
  }

  return (
    <div>
      <h1>Admin</h1>
      <p>Welcome {session.user.name}</p>
      <p>Role: {session.user.role}</p>
      <p>API: {privateData.data?.message}</p>
    </div>
  );
}

import { Outlet } from "react-router";

import { AdminRouteGuard } from "@/components/admin-route-guard";

export default function InstitutionsLayout() {
  return (
    <AdminRouteGuard>
      <Outlet />
    </AdminRouteGuard>
  );
}

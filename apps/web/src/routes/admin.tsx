import { Outlet } from "react-router";

import { AdminRouteGuard } from "@/components/admin-route-guard";

export default function AdminLayout() {
  return (
    <AdminRouteGuard>
      <Outlet />
    </AdminRouteGuard>
  );
}

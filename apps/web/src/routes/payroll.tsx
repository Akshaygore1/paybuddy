import { Outlet } from "react-router";

import { UserRouteGuard } from "@/components/user-route-guard";

export default function PayrollLayout() {
  return (
    <UserRouteGuard>
      <Outlet />
    </UserRouteGuard>
  );
}

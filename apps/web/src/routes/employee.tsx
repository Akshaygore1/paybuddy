import { PageHeader } from "@/components/page-header";
import { UserRouteGuard } from "@/components/user-route-guard";

export default function EmployeePage() {
  return (
    <UserRouteGuard>
      <section className="space-y-6 p-6">
        <PageHeader
          title="Employee"
          description="Employee workspace placeholder. More features will be added here."
        />
      </section>
    </UserRouteGuard>
  );
}

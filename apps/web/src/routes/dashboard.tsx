import {
  Building2Icon,
  BriefcaseBusinessIcon,
  FileTextIcon,
  ReceiptIndianRupeeIcon,
  WalletCardsIcon,
  type LucideIcon,
} from "lucide-react";
import { Link, Navigate } from "react-router";
import { PageHeader } from "@/components/page-header";
import { Button } from "@paybuddy/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@paybuddy/ui/components/card";

import Loader from "@/components/loader";
import { authClient } from "@/lib/auth-client";

type DashboardLink = {
  title: string;
  description: string;
  to: string;
  icon: LucideIcon;
};

const adminDashboardLinks: DashboardLink[] = [
  {
    title: "Institution",
    description: "Manage institute records and access.",
    to: "/institutions",
    icon: Building2Icon,
  },
  {
    title: "Reports",
    description: "Review financial-year payroll reports.",
    to: "/reports",
    icon: FileTextIcon,
  },
];

const instituteDashboardLinks: DashboardLink[] = [
  {
    title: "Employee",
    description: "Maintain employee directory.",
    to: "/employee",
    icon: WalletCardsIcon,
  },
  {
    title: "Payroll",
    description: "Prepare monthly payroll.",
    to: "/payroll",
    icon: ReceiptIndianRupeeIcon,
  },
  {
    title: "Reports",
    description: "Review financial-year payroll reports.",
    to: "/reports",
    icon: FileTextIcon,
  },
  {
    title: "Employee Setup",
    description: "Configure designations and custom fields.",
    to: "/institution-settings",
    icon: BriefcaseBusinessIcon,
  },
];

export default function Dashboard() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return <Loader />;
  }

  if (!session) {
    return <Navigate to="/sign-in" replace />;
  }

  const dashboardLinks =
    session.user.role === "admin"
      ? adminDashboardLinks
      : instituteDashboardLinks;

  return (
    <section className="space-y-6 p-6">
      <PageHeader
        title="Dashboard"
        description="Open the payroll workspace area you need."
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {dashboardLinks.map((item) => (
          <Card key={item.to}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg border bg-background text-muted-foreground">
                  <item.icon className="size-4" />
                </div>
                <CardTitle>{item.title}</CardTitle>
              </div>
              <CardDescription>{item.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Link to={item.to}>
                <Button variant="outline">Open {item.title}</Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

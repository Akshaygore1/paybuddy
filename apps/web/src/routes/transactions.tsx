import { Navigate } from "react-router";

import Loader from "@/components/loader";
import { PageHeader } from "@/components/page-header";
import { Button } from "@paybuddy/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@paybuddy/ui/components/card";
import { authClient } from "@/lib/auth-client";

const transactions = [
  {
    id: 1,
    name: "Stripe Payout",
    date: "Jun 21, 2026",
    amount: "+$2,400.00",
    status: "Completed",
  },
  {
    id: 2,
    name: "AWS Hosting",
    date: "Jun 20, 2026",
    amount: "-$120.00",
    status: "Completed",
  },
  {
    id: 3,
    name: "Client Invoice #1042",
    date: "Jun 18, 2026",
    amount: "+$5,800.00",
    status: "Completed",
  },
  {
    id: 4,
    name: "Figma Subscription",
    date: "Jun 15, 2026",
    amount: "-$45.00",
    status: "Completed",
  },
  {
    id: 5,
    name: "Refund — Order #8831",
    date: "Jun 12, 2026",
    amount: "-$89.00",
    status: "Pending",
  },
];

export default function Transactions() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return <Loader />;
  }

  if (!session) {
    return <Navigate to="/sign-in" replace />;
  }

  return (
    <section className="p-6">
      <PageHeader
        title="Transactions"
        description="Review your recent payment activity and account history."
        action={<Button>Export CSV</Button>}
      />
    </section>
  );
}

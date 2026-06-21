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

const cards = [
  { id: 1, label: "Main Wallet", last4: "4242", balance: "$12,480.50" },
  { id: 2, label: "Savings", last4: "8819", balance: "$34,200.00" },
  { id: 3, label: "Business", last4: "0152", balance: "$8,930.75" },
];

export default function Wallet() {
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
        title="Wallet"
        description="Manage your balances and linked accounts."
        action={<Button>Add funds</Button>}
      />
    </section>
  );
}

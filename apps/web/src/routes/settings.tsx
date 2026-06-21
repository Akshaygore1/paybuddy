import { Navigate } from "react-router";

import Loader from "@/components/loader";
import { PageHeader } from "@/components/page-header";
import { Button } from "@paybuddy/ui/components/button";
import { authClient } from "@/lib/auth-client";

export default function Settings() {
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
        title="Settings"
        description="Update your account preferences and profile details."
        action={<Button>Save changes</Button>}
      />
    </section>
  );
}

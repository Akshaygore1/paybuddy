import { Button } from "@paybuddy/ui/components/button";
import { Skeleton } from "@paybuddy/ui/components/skeleton";
import { LogOutIcon } from "lucide-react";
import { Link, useNavigate } from "react-router";

import { authClient } from "@/lib/auth-client";

export default function UserMenu() {
  const navigate = useNavigate();
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return <Skeleton className="h-9 w-24" />;
  }

  if (!session) {
    return (
      <Link to="/sign-in">
        <Button variant="outline">Sign In</Button>
      </Link>
    );
  }

  return (
    <Button
      variant="outline"
      onClick={() => {
        authClient.signOut({
          fetchOptions: {
            onSuccess: () => {
              navigate("/sign-in");
            },
          },
        });
      }}
    >
      {/*<LogOutIcon />*/}
      Sign Out
    </Button>
  );
}

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@paybuddy/ui/components/card";
import { Navigate } from "react-router";

import SignInForm from "@/components/sign-in-form";
import Loader from "@/components/loader";
import { authClient } from "@/lib/auth-client";
import { getDefaultRouteForRole } from "@/lib/auth-routing";

export default function SignIn() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return <Loader />;
  }

  if (session) {
    return <Navigate to={getDefaultRouteForRole(session.user.role)} replace />;
  }

  return (
    <main className="relative flex min-h-svh items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,oklch(from_var(--color-primary)_l_c_h_/_0.12),transparent_48%),radial-gradient(circle_at_bottom,oklch(from_var(--color-border)_l_c_h_/_0.55),transparent_38%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent,oklch(from_var(--color-background)_l_c_h_/_0.9))]" />
      <Card className="relative w-full max-w-md border border-border/70 bg-card/95 py-0 shadow-[0_24px_80px_oklch(0_0_0_/_0.08)] backdrop-blur">
        <CardHeader className="gap-2 border-b border-border/80 py-6">
          <CardTitle className="text-2xl font-semibold tracking-tight">Welcome back</CardTitle>
          <CardDescription className="text-sm">
            Sign in to continue to your workspace.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 py-6">
          <SignInForm />
        </CardContent>
        <CardFooter className="justify-center border-border/80 px-4 py-4 text-center text-xs text-muted-foreground">
          Public registration is disabled. Contact an administrator if you need access.
        </CardFooter>
      </Card>
    </main>
  );
}

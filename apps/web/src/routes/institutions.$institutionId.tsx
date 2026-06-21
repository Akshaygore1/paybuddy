import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@paybuddy/ui/components/card";
import { resetInstitutionPasswordSchema } from "@paybuddy/api/schemas/institutions";
import { Button } from "@paybuddy/ui/components/button";
import { Input } from "@paybuddy/ui/components/input";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { queryClient, trpc } from "@/utils/trpc";

function formatDate(value: Date | string | number) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function InstitutionDetailPage() {
  const params = useParams();
  const institutionId = params.institutionId ?? "";
  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const institutionQuery = useQuery(
    trpc.institutions.getById.queryOptions(
      { institutionId },
      {
        enabled: Boolean(institutionId),
      },
    ),
  );

  const resetPasswordMutation = useMutation(
    trpc.institutions.resetPassword.mutationOptions({
      onSuccess: () => {
        toast.success("Institution password reset");
        setNewPassword("");
        setPasswordError(null);
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  const deactivateMutation = useMutation(
    trpc.institutions.deactivateLogin.mutationOptions({
      onSuccess: async () => {
        toast.success("Institution login deactivated");
        await queryClient.invalidateQueries();
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  if (!institutionId) {
    return null;
  }

  const institution = institutionQuery.data;

  async function handleResetPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsed = resetInstitutionPasswordSchema.safeParse({
      institutionId,
      password: newPassword,
    });

    if (!parsed.success) {
      setPasswordError(parsed.error.issues[0]?.message ?? "Invalid password");
      return;
    }

    await resetPasswordMutation.mutateAsync({
      institutionId,
      password: newPassword,
    });
  }

  return (
    <section className="space-y-6 p-6">
      <PageHeader
        title={institution?.name ?? "Institution"}
        description="Review institution profile details and manage login access."
        action={
          <Link
            className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background px-3 text-sm font-medium hover:bg-muted"
            to="/institutions"
          >
            Back to Institutions
          </Link>
        }
      />

      {institution ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_360px]">
          <Card>
            <CardHeader>
              <CardTitle>Institution details</CardTitle>
              <CardDescription>
                Current login status:{" "}
                {institution.loginActive ? "Active" : "Inactive"}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">
                  Institution Name
                </p>
                <p className="font-medium">{institution.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">TAN Number</p>
                <p className="font-medium">{institution.tanNumber}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  Institution Head
                </p>
                <p className="font-medium">{institution.institutionHead}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Username</p>
                <p className="font-medium">
                  {institution.username ?? "Not set"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  System User Name
                </p>
                <p className="font-medium">{institution.userName}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">System Email</p>
                <p className="font-medium">{institution.email}</p>
              </div>
              <div className="md:col-span-2">
                <p className="text-sm text-muted-foreground">Address</p>
                <p className="font-medium">{institution.address}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Created</p>
                <p className="font-medium">
                  {formatDate(institution.createdAt)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Last Updated</p>
                <p className="font-medium">
                  {formatDate(institution.updatedAt)}
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Reset password</CardTitle>
                <CardDescription>
                  Set a new manual password for this institution login.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={handleResetPassword}>
                  <label className="block space-y-2">
                    <span className="text-sm font-medium">New Password</span>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(event) => {
                        setNewPassword(event.target.value);
                        setPasswordError(null);
                      }}
                    />
                    {passwordError ? (
                      <p className="text-sm text-destructive">
                        {passwordError}
                      </p>
                    ) : null}
                  </label>
                  <Button
                    type="submit"
                    disabled={resetPasswordMutation.isPending}
                  >
                    {resetPasswordMutation.isPending
                      ? "Resetting..."
                      : "Reset Password"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Login access</CardTitle>
                <CardDescription>
                  Deactivation blocks future sign-ins while keeping the
                  institution record visible.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border border-border/80 bg-muted/30 p-4 text-sm">
                  <p className="font-medium">
                    Status: {institution.loginActive ? "Active" : "Inactive"}
                  </p>
                </div>
                <Button
                  variant="destructive"
                  disabled={
                    !institution.loginActive || deactivateMutation.isPending
                  }
                  onClick={() => {
                    deactivateMutation.mutate({ institutionId });
                  }}
                >
                  {deactivateMutation.isPending
                    ? "Deactivating..."
                    : "Deactivate Login"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}
    </section>
  );
}

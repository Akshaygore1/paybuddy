import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@paybuddy/ui/components/card";
import { Button } from "@paybuddy/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router";

import { PageHeader } from "@/components/page-header";
import { trpc } from "@/utils/trpc";

function formatDate(value: Date | string | number) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function InstitutionsIndexPage() {
  const navigate = useNavigate();

  const institutionsQuery = useQuery(trpc.institutions.list.queryOptions());

  return (
    <section className="space-y-6 p-6">
      <PageHeader
        title="Institution"
        description="Review institution records, profile details, and access status."
        action={
          <Button onClick={() => navigate("/institutions/create")}>
            Create Institution
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Institution directory</CardTitle>
          <CardDescription>
            Review created institutions and open a record to reset credentials or deactivate
            login.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-3 pr-4 font-medium">Institution Name</th>
                <th className="py-3 pr-4 font-medium">TAN Number</th>
                <th className="py-3 pr-4 font-medium">Institution Head</th>
                <th className="py-3 pr-4 font-medium">Username</th>
                <th className="py-3 pr-4 font-medium">Login Status</th>
                <th className="py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {institutionsQuery.data?.map((institution) => (
                <tr key={institution.id} className="hover:bg-muted/40">
                  <td className="py-3 pr-4 font-medium">
                    <Link className="hover:underline" to={`/institutions/${institution.id}`}>
                      {institution.name}
                    </Link>
                  </td>
                  <td className="py-3 pr-4">{institution.tanNumber}</td>
                  <td className="py-3 pr-4">{institution.institutionHead}</td>
                  <td className="py-3 pr-4">{institution.username ?? "Not set"}</td>
                  <td className="py-3 pr-4">
                    {institution.loginActive ? "Active" : "Inactive"}
                  </td>
                  <td className="py-3">{formatDate(institution.createdAt)}</td>
                </tr>
              ))}
              {institutionsQuery.data?.length === 0 ? (
                <tr>
                  <td className="py-6 text-muted-foreground" colSpan={6}>
                    No institutions have been created yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </section>
  );
}

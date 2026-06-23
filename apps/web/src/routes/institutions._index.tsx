import * as React from "react";
import { Badge } from "@paybuddy/ui/components/badge";
import { Button } from "@paybuddy/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@paybuddy/ui/components/card";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@paybuddy/ui/components/pagination";
import { Skeleton } from "@paybuddy/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@paybuddy/ui/components/table";
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

const PAGE_SIZE = 10;

export default function InstitutionsIndexPage() {
  const navigate = useNavigate();
  const institutionsQuery = useQuery(trpc.institutions.list.queryOptions());
  const institutions = institutionsQuery.data ?? [];
  const [pageIndex, setPageIndex] = React.useState(0);

  const totalRows = institutions.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
  const clampedPageIndex = Math.min(pageIndex, totalPages - 1);
  const pageStart = clampedPageIndex * PAGE_SIZE;
  const paginatedInstitutions = institutions.slice(pageStart, pageStart + PAGE_SIZE);
  const rangeStart = totalRows === 0 ? 0 : pageStart + 1;
  const rangeEnd =
    totalRows === 0 ? 0 : Math.min(pageStart + paginatedInstitutions.length, totalRows);

  React.useEffect(() => {
    if (pageIndex !== clampedPageIndex) {
      setPageIndex(clampedPageIndex);
    }
  }, [clampedPageIndex, pageIndex]);

  const canGoPrevious = clampedPageIndex > 0;
  const canGoNext = clampedPageIndex < totalPages - 1;

  return (
    <section className="space-y-6 p-6">
      <PageHeader
        title="Institution"
        description="Review institution records, profile details, and access status."
        action={
          <Button onClick={() => navigate("/institutions/create")}>Create Institution</Button>
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
        <CardContent className="flex flex-col gap-4">
          <Table aria-label="Institution directory">
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-48">Institution Name</TableHead>
                <TableHead>TAN Number</TableHead>
                <TableHead>Institution Head</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Login Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {institutionsQuery.isPending
                ? Array.from({ length: 5 }, (_, rowIndex) => (
                    <TableRow key={`loading-${rowIndex}`}>
                      {Array.from({ length: 6 }, (_, cellIndex) => (
                        <TableCell key={`loading-${rowIndex}-${cellIndex}`}>
                          <Skeleton className={cellIndex === 0 ? "h-4 w-36" : "h-4 w-24"} />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : null}

              {!institutionsQuery.isPending && paginatedInstitutions.length > 0
                ? paginatedInstitutions.map((institution) => (
                    <TableRow key={institution.id}>
                      <TableCell className="font-medium">
                        <Link
                          className="underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                          to={`/institutions/${institution.id}`}
                        >
                          {institution.name}
                        </Link>
                      </TableCell>
                      <TableCell>{institution.tanNumber}</TableCell>
                      <TableCell>{institution.institutionHead}</TableCell>
                      <TableCell>{institution.username ?? "Not set"}</TableCell>
                      <TableCell>
                        <Badge variant={institution.loginActive ? "secondary" : "outline"}>
                          {institution.loginActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(institution.createdAt)}</TableCell>
                    </TableRow>
                  ))
                : null}

              {!institutionsQuery.isPending && totalRows === 0 ? (
                <TableRow>
                  <TableCell className="h-24 text-center text-muted-foreground" colSpan={6}>
                    No institutions have been created yet.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>

          {!institutionsQuery.isPending && totalRows > 0 ? (
            <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {rangeStart}-{rangeEnd} of {totalRows}
              </p>
              <Pagination className="mx-0 w-auto justify-start sm:justify-end">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      disabled={!canGoPrevious}
                      onClick={() => setPageIndex((current) => Math.max(current - 1, 0))}
                      variant="outline"
                    />
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationNext
                      disabled={!canGoNext}
                      onClick={() =>
                        setPageIndex((current) => Math.min(current + 1, totalPages - 1))
                      }
                      variant="outline"
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}

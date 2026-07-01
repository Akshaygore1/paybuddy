import * as React from "react";
import { Button } from "@paybuddy/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@paybuddy/ui/components/card";
import { Input } from "@paybuddy/ui/components/input";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@paybuddy/ui/components/pagination";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@paybuddy/ui/components/select";
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
import { Navigate } from "react-router";

import Loader from "@/components/loader";
import { PageHeader } from "@/components/page-header";
import { authClient } from "@/lib/auth-client";
import {
  financialYearChangeEvent,
  getFinancialYearLabel,
  readSelectedFinancialYearStart,
  type FinancialYearStart,
} from "@/lib/financial-year";
import { trpc } from "@/utils/trpc";

function formatCurrency(amountPaise: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(amountPaise / 100);
}

function normalizeSearchText(value: string) {
  return value.trim().toLocaleLowerCase();
}

function escapeCsvValue(value: string) {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

const PAGE_SIZE = 10;

const reportColumnDefinitions = [
  { key: "name", label: "Name" },
  { key: "grossSalary", label: "Gross Salary" },
  { key: "deduction", label: "Deduction" },
  { key: "netSalary", label: "Net Salary" },
  { key: "tdsDeductedTillNow", label: "TDS Deducted Till Now" },
  { key: "totalTax", label: "Total Tax" },
  { key: "pendingTds", label: "Pending TDS" },
] as const;

type ReportRow = {
  employeeId: string;
  name: string;
  grossSalaryPaise: number;
  deductionPaise: number;
  netSalaryPaise: number;
  tdsDeductedTillNowPaise: number;
  totalTaxPaise: number;
  pendingTdsPaise: number;
};

type ReportColumnKey = (typeof reportColumnDefinitions)[number]["key"];

type ReportColumn = {
  key: ReportColumnKey;
  label: string;
  getValue(row: ReportRow): string;
  isNumeric?: boolean;
};

export default function ReportsPage() {
  const { data: session, isPending } = authClient.useSession();
  const [financialYearStart, setFinancialYearStart] =
    React.useState<FinancialYearStart>(() => readSelectedFinancialYearStart());
  const [selectedInstitutionId, setSelectedInstitutionId] = React.useState("");
  const [pageIndex, setPageIndex] = React.useState(0);
  const [searchTerm, setSearchTerm] = React.useState("");
  const isAdmin = session?.user.role === "admin";
  const shouldFetchReport =
    session?.user.role === "user" || (isAdmin && selectedInstitutionId);

  const institutionsQuery = useQuery({
    ...trpc.institutions.list.queryOptions(),
    enabled: isAdmin,
  });
  const reportQuery = useQuery({
    ...trpc.reports.getReport.queryOptions({
      financialYearStart,
      institutionId: selectedInstitutionId || undefined,
    }),
    enabled: Boolean(shouldFetchReport),
  });

  React.useEffect(() => {
    function syncFinancialYear(event: Event) {
      const customEvent = event as CustomEvent<{
        financialYearStart?: FinancialYearStart;
      }>;

      setFinancialYearStart(
        customEvent.detail?.financialYearStart ??
          readSelectedFinancialYearStart(),
      );
    }

    window.addEventListener(financialYearChangeEvent, syncFinancialYear);
    return () =>
      window.removeEventListener(financialYearChangeEvent, syncFinancialYear);
  }, []);
  const reportRows = reportQuery.data?.rows ?? [];
  const isReportLoading = reportQuery.isPending && Boolean(shouldFetchReport);
  const selectedInstitutionName =
    reportQuery.data?.institution.name ??
    institutionsQuery.data?.find(
      (institution) => institution.id === selectedInstitutionId,
    )?.name;
  const pageTitle = selectedInstitutionName
    ? `Reports - ${selectedInstitutionName}`
    : "Reports";
  const searchableColumns = React.useMemo<ReportColumn[]>(
    () =>
      reportColumnDefinitions.map((column) => ({
        key: column.key,
        label: column.label,
        isNumeric: column.key !== "name",
        getValue(row) {
          switch (column.key) {
            case "name":
              return row.name;
            case "grossSalary":
              return formatCurrency(row.grossSalaryPaise);
            case "deduction":
              return formatCurrency(row.deductionPaise);
            case "netSalary":
              return formatCurrency(row.netSalaryPaise);
            case "tdsDeductedTillNow":
              return formatCurrency(row.tdsDeductedTillNowPaise);
            case "totalTax":
              return formatCurrency(row.totalTaxPaise);
            case "pendingTds":
              return formatCurrency(row.pendingTdsPaise);
          }
        },
      })),
    [],
  );
  const normalizedSearchTerm = normalizeSearchText(searchTerm);
  const filteredReportRows = React.useMemo(() => {
    if (!normalizedSearchTerm) {
      return reportRows;
    }

    return reportRows.filter((row) =>
      searchableColumns.some((column) =>
        normalizeSearchText(column.getValue(row)).includes(normalizedSearchTerm),
      ),
    );
  }, [normalizedSearchTerm, reportRows, searchableColumns]);
  const visibleColumnCount = reportColumnDefinitions.length;
  const totalRows = reportRows.length;
  const filteredRows = filteredReportRows.length;
  const totalPages = Math.max(1, Math.ceil(filteredRows / PAGE_SIZE));
  const clampedPageIndex = Math.min(pageIndex, totalPages - 1);
  const pageStart = clampedPageIndex * PAGE_SIZE;
  const paginatedRows = filteredReportRows.slice(pageStart, pageStart + PAGE_SIZE);
  const rangeStart = filteredRows === 0 ? 0 : pageStart + 1;
  const rangeEnd =
    filteredRows === 0 ? 0 : Math.min(pageStart + paginatedRows.length, filteredRows);
  const canGoPrevious = clampedPageIndex > 0;
  const canGoNext = clampedPageIndex < totalPages - 1;
  const hasSearch = normalizedSearchTerm.length > 0;

  React.useEffect(() => {
    if (pageIndex !== clampedPageIndex) {
      setPageIndex(clampedPageIndex);
    }
  }, [clampedPageIndex, pageIndex]);

  if (isPending) {
    return <Loader />;
  }

  if (!session) {
    return <Navigate to="/sign-in" replace />;
  }

  function handleSearchTermChange(event: React.ChangeEvent<HTMLInputElement>) {
    setSearchTerm(event.target.value);
    setPageIndex(0);
  }

  function handleDownloadCsv() {
    const csvRows = [
      searchableColumns.map((column) => escapeCsvValue(column.label)).join(","),
      ...filteredReportRows.map((row) =>
        searchableColumns
          .map((column) => escapeCsvValue(column.getValue(row)))
          .join(","),
      ),
    ];
    const blob = new Blob([csvRows.join("\r\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "fy-payroll-report.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="space-y-6 p-6">
      <PageHeader
        title={pageTitle}
        description="Review financial-year payroll totals and pending TDS for an institute."
        action={
          isAdmin ? (
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="reports-institute">
                Institute
              </label>
              <Select
                value={selectedInstitutionId}
                onValueChange={(value) => setSelectedInstitutionId(value ?? "")}
              >
                <SelectTrigger
                  id="reports-institute"
                  aria-label="Select institute"
                >
                  <SelectValue placeholder="Select institute">
                    {selectedInstitutionId
                      ? (selectedInstitutionName ?? "Select institute")
                      : "Select institute"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {(institutionsQuery.data ?? []).map((institution) => (
                      <SelectItem key={institution.id} value={institution.id}>
                        {institution.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          ) : null
        }
      />

      {/*<Card>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">

        </CardContent>
      </Card>*/}

      <Card>
        <CardHeader>
          <CardTitle>FY payroll report</CardTitle>
          <CardDescription>
            {selectedInstitutionName
              ? `${selectedInstitutionName} · FY ${getFinancialYearLabel(financialYearStart)}`
              : "Select an institute to load report totals."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {isAdmin && !selectedInstitutionId ? (
            <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              Select an institute to view the report.
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex-1">
                  <label className="sr-only" htmlFor="reports-search">
                    Search reports
                  </label>
                  <Input
                    id="reports-search"
                    value={searchTerm}
                    onChange={handleSearchTermChange}
                    placeholder="Search visible columns"
                    type="search"
                    className="w-full sm:max-w-xs"
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={handleDownloadCsv}
                  disabled={isReportLoading || totalRows === 0}
                >
                  Download CSV
                </Button>
              </div>

              <div className="overflow-hidden rounded-lg border">
                <Table aria-label="Reports table">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-48">Name</TableHead>
                      <TableHead className="text-right">Gross Salary</TableHead>
                      <TableHead className="text-right">Deduction</TableHead>
                      <TableHead className="text-right">Net Salary</TableHead>
                      <TableHead className="text-right">
                        TDS Deducted Till Now
                      </TableHead>
                      <TableHead className="text-right">Total Tax</TableHead>
                      <TableHead className="text-right">Pending TDS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isReportLoading
                      ? Array.from({ length: 5 }, (_, rowIndex) => (
                          <TableRow key={`loading-${rowIndex}`}>
                            {reportColumnDefinitions.map((column) => (
                              <TableCell key={`${column.key}-${rowIndex}`}>
                                <Skeleton
                                  className={
                                    column.key === "name"
                                      ? "h-4 w-36"
                                      : "ml-auto h-4 w-24"
                                  }
                                />
                              </TableCell>
                            ))}
                          </TableRow>
                        ))
                      : null}

                    {!isReportLoading && paginatedRows.length > 0
                      ? paginatedRows.map((row) => (
                          <TableRow key={row.employeeId}>
                            {searchableColumns.map((column) => (
                              <TableCell
                                className={
                                  column.isNumeric ? "text-right" : "font-medium"
                                }
                                key={column.key}
                              >
                                {column.getValue(row)}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))
                      : null}

                    {!isReportLoading && totalRows === 0 ? (
                      <TableRow>
                        <TableCell
                          className="h-24 text-center text-muted-foreground"
                          colSpan={Math.max(visibleColumnCount, 1)}
                        >
                          No employees or saved payroll data are available for this
                          institute and financial year.
                        </TableCell>
                      </TableRow>
                    ) : null}

                    {!isReportLoading && totalRows > 0 && filteredRows === 0 ? (
                      <TableRow>
                        <TableCell
                          className="h-24 text-center text-muted-foreground"
                          colSpan={Math.max(visibleColumnCount, 1)}
                        >
                          No report rows match your search.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </div>

              {!isReportLoading && filteredRows > 0 ? (
                <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-muted-foreground">
                    {hasSearch
                      ? `Showing ${rangeStart}-${rangeEnd} of ${filteredRows} matches (${totalRows} total)`
                      : `Showing ${rangeStart}-${rangeEnd} of ${totalRows}`}
                  </p>
                  <Pagination className="mx-0 w-auto justify-start sm:justify-end">
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          disabled={!canGoPrevious}
                          onClick={() =>
                            setPageIndex((current) => Math.max(current - 1, 0))
                          }
                          variant="outline"
                        />
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationNext
                          disabled={!canGoNext}
                          onClick={() =>
                            setPageIndex((current) =>
                              Math.min(current + 1, totalPages - 1),
                            )
                          }
                          variant="outline"
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

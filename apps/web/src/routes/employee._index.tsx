import * as React from "react";
import { Button } from "@tds-nivaran/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@tds-nivaran/ui/components/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@tds-nivaran/ui/components/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@tds-nivaran/ui/components/dropdown-menu";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@tds-nivaran/ui/components/pagination";
import { Input } from "@tds-nivaran/ui/components/input";
import { Skeleton } from "@tds-nivaran/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@tds-nivaran/ui/components/table";
import { useMutation, useQuery } from "@tanstack/react-query";
import { MoreHorizontalIcon } from "lucide-react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import {
  buildEmployeeDirectoryCsv,
  getInitialDirectoryColumnVisibility,
  projectEmployeeDirectory,
} from "@/lib/employee-directory";
import { queryClient, trpc } from "@/utils/trpc";

const PAGE_SIZE = 10;

export default function EmployeeIndexPage() {
  const navigate = useNavigate();
  const employeesQuery = useQuery(trpc.employees.getDirectory.queryOptions());
  const employees = employeesQuery.data?.rows ?? [];
  const columns = employeesQuery.data?.columns ?? [];

  const [pageIndex, setPageIndex] = React.useState(0);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [visibleColumns, setVisibleColumns] = React.useState<Record<string, boolean>>({});
  const [employeePendingDelete, setEmployeePendingDelete] = React.useState<
    (typeof employees)[number] | null
  >(null);

  const directory = React.useMemo(
    () =>
      projectEmployeeDirectory({
        columns,
        rows: employees,
        visibleColumns,
        searchTerm,
        pageIndex,
        pageSize: PAGE_SIZE,
      }),
    [columns, employees, pageIndex, searchTerm, visibleColumns],
  );
  const visibleColumnCount = directory.columns.length;

  const deleteEmployeeMutation = useMutation(
    trpc.employees.delete.mutationOptions({
      onSuccess: async () => {
        toast.success("Employee deleted");
        setEmployeePendingDelete(null);
        await queryClient.invalidateQueries({
          queryKey: trpc.employees.getDirectory.queryKey(),
        });
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  const totalRows = employees.length;
  const filteredRows = directory.filteredRows.length;
  const totalPages = directory.totalPages;
  const clampedPageIndex = directory.pageIndex;
  const pageStart = directory.pageStart;
  const paginatedEmployees = directory.pageRows;
  const rangeStart = filteredRows === 0 ? 0 : pageStart + 1;
  const rangeEnd =
    filteredRows === 0 ? 0 : Math.min(pageStart + paginatedEmployees.length, filteredRows);
  const canGoPrevious = clampedPageIndex > 0;
  const canGoNext = clampedPageIndex < totalPages - 1;
  const hasSearch = searchTerm.trim().length > 0;

  React.useEffect(() => {
    setVisibleColumns((current) => ({
      ...getInitialDirectoryColumnVisibility(columns),
      ...current,
    }));
  }, [columns]);

  React.useEffect(() => {
    if (pageIndex !== clampedPageIndex) {
      setPageIndex(clampedPageIndex);
    }
  }, [clampedPageIndex, pageIndex]);

  function handleSearchTermChange(event: React.ChangeEvent<HTMLInputElement>) {
    setSearchTerm(event.target.value);
    setPageIndex(0);
  }

  function toggleColumn(columnKey: string, checked: boolean) {
    setVisibleColumns((current) => ({
      ...current,
      [columnKey]: checked,
    }));
  }

  function handleDownloadCsv() {
    if (directory.columns.length === 0) {
      return;
    }
    const blob = new Blob(
      [buildEmployeeDirectoryCsv({ columns: directory.columns, rows: employees })],
      {
        type: "text/csv;charset=utf-8",
      },
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "employee-directory.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function handleDeleteEmployee() {
    if (!employeePendingDelete) {
      return;
    }

    await deleteEmployeeMutation.mutateAsync({
      employeeId: employeePendingDelete.id,
    });
  }

  return (
    <section className="space-y-6 p-6">
      <PageHeader
        title="Employee"
        description="Review the current employee directory for your institution."
        action={
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline">Choose Columns</Button>} />
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {columns
                  .filter((column) => column.kind === "fixed")
                  .map((column) => (
                    <DropdownMenuCheckboxItem
                      checked={visibleColumns[column.key]}
                      key={column.key}
                      onCheckedChange={(checked) => toggleColumn(column.key, Boolean(checked))}
                    >
                      {column.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                {columns.some((column) => column.kind === "custom") ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Custom fields</DropdownMenuLabel>
                    {columns
                      .filter((column) => column.kind === "custom")
                      .map((column) => {
                        return (
                          <DropdownMenuCheckboxItem
                            checked={visibleColumns[column.key] ?? false}
                            key={column.key}
                            onCheckedChange={(checked) =>
                              toggleColumn(column.key, Boolean(checked))
                            }
                          >
                            {column.label}
                          </DropdownMenuCheckboxItem>
                        );
                      })}
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={() => navigate("/employee/create")}>Add Employee</Button>
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Employee directory</CardTitle>
          <CardDescription>
            {totalRows === 0
              ? "No employees created yet"
              : hasSearch
                ? `${filteredRows} matching employee records of ${totalRows}`
                : `${totalRows} employee records`}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1">
              <label className="sr-only" htmlFor="employee-directory-search">
                Search employees
              </label>
              <Input
                id="employee-directory-search"
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
              disabled={employeesQuery.isPending || totalRows === 0 || visibleColumnCount === 0}
            >
              Download CSV
            </Button>
          </div>

          <div className="overflow-hidden rounded-lg border">
            <Table aria-label="Employee directory">
              <TableHeader>
                <TableRow>
                  {directory.columns.map((column) => (
                    <TableHead
                      className={column.key === "employee" ? "min-w-56" : undefined}
                      key={column.key}
                    >
                      {column.label}
                    </TableHead>
                  ))}
                  <TableHead className="w-12 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employeesQuery.isPending
                  ? Array.from({ length: 5 }, (_, rowIndex) => (
                      <TableRow key={`loading-${rowIndex}`}>
                        {directory.columns.map((column) => (
                          <TableCell key={`${column.key}-${rowIndex}`}>
                            <Skeleton
                              className={column.key === "employee" ? "h-4 w-40" : "h-4 w-24"}
                            />
                          </TableCell>
                        ))}
                        <TableCell>
                          <Skeleton className="ml-auto h-8 w-8" />
                        </TableCell>
                      </TableRow>
                    ))
                  : null}

                {!employeesQuery.isPending && paginatedEmployees.length > 0
                  ? paginatedEmployees.map(({ row: employee, values }) => (
                      <TableRow key={employee.id}>
                        {directory.columns.map((column) => (
                          <TableCell
                            className={
                              column.key === "employee" || column.key === "designation"
                                ? "whitespace-normal"
                                : undefined
                            }
                            key={column.key}
                          >
                            {values[column.key] || "Not provided"}
                          </TableCell>
                        ))}
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label="Employee actions"
                                />
                              }
                            >
                              <MoreHorizontalIcon />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => navigate(`/employee/${employee.id}/edit`)}
                              >
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setEmployeePendingDelete(employee)}
                                variant="destructive"
                              >
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  : null}

                {!employeesQuery.isPending && totalRows === 0 ? (
                  <TableRow>
                    <TableCell
                      className="h-24 text-center text-muted-foreground"
                      colSpan={visibleColumnCount + 1}
                    >
                      Start by creating a designation in Employee Setup, then add your first
                      employee here.
                    </TableCell>
                  </TableRow>
                ) : null}

                {!employeesQuery.isPending && totalRows > 0 && filteredRows === 0 ? (
                  <TableRow>
                    <TableCell
                      className="h-24 text-center text-muted-foreground"
                      colSpan={visibleColumnCount + 1}
                    >
                      No employees match your search.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>

          {!employeesQuery.isPending && filteredRows > 0 ? (
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

      <Dialog
        onOpenChange={(open) => {
          if (!open && !deleteEmployeeMutation.isPending) {
            setEmployeePendingDelete(null);
          }
        }}
        open={employeePendingDelete !== null}
      >
        <DialogContent showCloseButton={!deleteEmployeeMutation.isPending}>
          <DialogHeader>
            <DialogTitle>Delete employee</DialogTitle>
            <DialogDescription>
              {employeePendingDelete
                ? `Delete ${employeePendingDelete.firstName} ${employeePendingDelete.surname}? This action is permanent and cannot be undone.`
                : "This action is permanent and cannot be undone."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEmployeePendingDelete(null)}
              disabled={deleteEmployeeMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                void handleDeleteEmployee();
              }}
              disabled={deleteEmployeeMutation.isPending}
            >
              {deleteEmployeeMutation.isPending ? "Deleting..." : "Delete employee"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

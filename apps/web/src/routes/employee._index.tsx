import * as React from "react";
import { Button } from "@paybuddy/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@paybuddy/ui/components/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@paybuddy/ui/components/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@paybuddy/ui/components/dropdown-menu";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@paybuddy/ui/components/pagination";
import { Input } from "@paybuddy/ui/components/input";
import { Skeleton } from "@paybuddy/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@paybuddy/ui/components/table";
import { useMutation, useQuery } from "@tanstack/react-query";
import { MoreHorizontalIcon } from "lucide-react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { queryClient, trpc } from "@/utils/trpc";

function formatDate(value: Date | string | number) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDateOnly(value: string) {
  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

const PAGE_SIZE = 10;

const fixedColumnDefinitions = [
  { key: "employee", label: "Employee", defaultVisible: true },
  { key: "rank", label: "Rank", defaultVisible: true },
  { key: "designation", label: "Designation", defaultVisible: true },
  { key: "dateOfBirth", label: "Date of Birth", defaultVisible: false },
  { key: "gender", label: "Gender", defaultVisible: false },
  { key: "contactNumber", label: "Contact", defaultVisible: true },
  { key: "whatsAppNumber", label: "WhatsApp", defaultVisible: false },
  { key: "panNumber", label: "PAN", defaultVisible: false },
  { key: "pfNumber", label: "PF", defaultVisible: false },
  { key: "npsAccountNumber", label: "NPS", defaultVisible: false },
  { key: "created", label: "Created", defaultVisible: true },
] as const;

function getCustomFieldColumnKey(fieldDefinitionId: string) {
  return `customField:${fieldDefinitionId}`;
}

function getEmployeeDisplayName(input: {
  surname: string;
  firstName: string;
  middleName: string;
}) {
  return [input.surname, input.firstName, input.middleName]
    .filter(Boolean)
    .join(" ");
}

function getDesignationDisplayValue(input: {
  designationName: string;
  designationIsActive: boolean;
}) {
  return input.designationIsActive
    ? input.designationName
    : `${input.designationName} (archived)`;
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

export default function EmployeeIndexPage() {
  const navigate = useNavigate();
  const employeesQuery = useQuery(trpc.employees.getDirectory.queryOptions());
  const formOptionsQuery = useQuery(
    trpc.employees.getCreateForm.queryOptions(),
  );
  const employees = employeesQuery.data?.rows ?? [];
  const customFieldDefinitions = formOptionsQuery.data?.customFields ?? [];

  const [pageIndex, setPageIndex] = React.useState(0);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [visibleColumns, setVisibleColumns] = React.useState<
    Record<string, boolean>
  >(
    Object.fromEntries(
      fixedColumnDefinitions.map((column) => [
        column.key,
        column.defaultVisible,
      ]),
    ),
  );
  const [employeePendingDelete, setEmployeePendingDelete] = React.useState<
    (typeof employees)[number] | null
  >(null);

  const visibleFixedColumns = fixedColumnDefinitions.filter(
    (column) => visibleColumns[column.key],
  );
  const visibleCustomFieldColumns = customFieldDefinitions.filter(
    (field) => visibleColumns[getCustomFieldColumnKey(field.id)],
  );
  const visibleColumnCount =
    visibleFixedColumns.length + visibleCustomFieldColumns.length;
  const searchableColumns = React.useMemo(
    () => [
      ...visibleFixedColumns.map((column) => ({
        key: column.key,
        label: column.label,
        getValue(employee: (typeof employees)[number]) {
          switch (column.key) {
            case "employee":
              return getEmployeeDisplayName(employee);
            case "rank":
              return String(employee.seniorityRank);
            case "designation":
              return getDesignationDisplayValue(employee);
            case "dateOfBirth":
              return formatDateOnly(employee.dateOfBirth);
            case "gender":
              return employee.gender;
            case "contactNumber":
              return employee.contactNumber ?? "";
            case "whatsAppNumber":
              return employee.whatsAppNumber ?? "";
            case "panNumber":
              return employee.panNumber ?? "";
            case "pfNumber":
              return employee.pfNumber ?? "";
            case "npsAccountNumber":
              return employee.npsAccountNumber ?? "";
            case "created":
              return formatDate(employee.createdAt);
            default:
              return "";
          }
        },
      })),
      ...visibleCustomFieldColumns.map((field) => ({
        key: getCustomFieldColumnKey(field.id),
        label: field.label,
        getValue(employee: (typeof employees)[number]) {
          return employee.values[getCustomFieldColumnKey(field.id)] ?? "";
        },
      })),
    ],
    [visibleCustomFieldColumns, visibleFixedColumns],
  );
  const normalizedSearchTerm = normalizeSearchText(searchTerm);
  const filteredEmployees = React.useMemo(() => {
    if (!normalizedSearchTerm) {
      return employees;
    }

    return employees.filter((employee) =>
      searchableColumns.some((column) =>
        normalizeSearchText(String(column.getValue(employee))).includes(
          normalizedSearchTerm,
        ),
      ),
    );
  }, [employees, normalizedSearchTerm, searchableColumns]);

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
  const filteredRows = filteredEmployees.length;
  const totalPages = Math.max(1, Math.ceil(filteredRows / PAGE_SIZE));
  const clampedPageIndex = Math.min(pageIndex, totalPages - 1);
  const pageStart = clampedPageIndex * PAGE_SIZE;
  const paginatedEmployees = filteredEmployees.slice(
    pageStart,
    pageStart + PAGE_SIZE,
  );
  const rangeStart = filteredRows === 0 ? 0 : pageStart + 1;
  const rangeEnd =
    filteredRows === 0
      ? 0
      : Math.min(pageStart + paginatedEmployees.length, filteredRows);
  const canGoPrevious = clampedPageIndex > 0;
  const canGoNext = clampedPageIndex < totalPages - 1;
  const hasSearch = normalizedSearchTerm.length > 0;

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
    if (searchableColumns.length === 0) {
      return;
    }

    const csvRows = [
      searchableColumns.map((column) => escapeCsvValue(column.label)).join(","),
      ...employees.map((employee) =>
        searchableColumns
          .map((column) => escapeCsvValue(String(column.getValue(employee))))
          .join(","),
      ),
    ];
    const blob = new Blob([csvRows.join("\r\n")], {
      type: "text/csv;charset=utf-8",
    });
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
              <DropdownMenuTrigger
                render={<Button variant="outline">Choose Columns</Button>}
              />
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {fixedColumnDefinitions.map((column) => (
                  <DropdownMenuCheckboxItem
                    checked={visibleColumns[column.key]}
                    key={column.key}
                    onCheckedChange={(checked) =>
                      toggleColumn(column.key, Boolean(checked))
                    }
                  >
                    {column.label}
                  </DropdownMenuCheckboxItem>
                ))}
                {customFieldDefinitions.length > 0 ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Custom fields</DropdownMenuLabel>
                    {customFieldDefinitions.map((field) => {
                      const columnKey = getCustomFieldColumnKey(field.id);

                      return (
                        <DropdownMenuCheckboxItem
                          checked={visibleColumns[columnKey] ?? false}
                          key={columnKey}
                          onCheckedChange={(checked) =>
                            toggleColumn(columnKey, Boolean(checked))
                          }
                        >
                          {field.label}
                        </DropdownMenuCheckboxItem>
                      );
                    })}
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={() => navigate("/employee/create")}>
              Add Employee
            </Button>
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
                  {visibleColumns.employee ? (
                    <TableHead className="min-w-56">Employee</TableHead>
                  ) : null}
                  {visibleColumns.rank ? <TableHead>Rank</TableHead> : null}
                  {visibleColumns.designation ? (
                    <TableHead>Designation</TableHead>
                  ) : null}
                  {visibleColumns.dateOfBirth ? (
                    <TableHead>Date of Birth</TableHead>
                  ) : null}
                  {visibleColumns.gender ? <TableHead>Gender</TableHead> : null}
                  {visibleColumns.contactNumber ? (
                    <TableHead>Contact</TableHead>
                  ) : null}
                  {visibleColumns.whatsAppNumber ? (
                    <TableHead>WhatsApp</TableHead>
                  ) : null}
                  {visibleColumns.panNumber ? <TableHead>PAN</TableHead> : null}
                  {visibleColumns.pfNumber ? <TableHead>PF</TableHead> : null}
                  {visibleColumns.npsAccountNumber ? (
                    <TableHead>NPS</TableHead>
                  ) : null}
                  {visibleCustomFieldColumns.map((field) => (
                    <TableHead className="min-w-40" key={field.id}>
                      {field.label}
                    </TableHead>
                  ))}
                  {visibleColumns.created ? <TableHead>Created</TableHead> : null}
                  <TableHead className="w-12 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employeesQuery.isPending
                  ? Array.from({ length: 5 }, (_, rowIndex) => (
                      <TableRow key={`loading-${rowIndex}`}>
                        {visibleFixedColumns.map((column) => (
                          <TableCell key={`${column.key}-${rowIndex}`}>
                            <Skeleton
                              className={
                                column.key === "employee"
                                  ? "h-4 w-40"
                                  : "h-4 w-24"
                              }
                            />
                          </TableCell>
                        ))}
                        {visibleCustomFieldColumns.map((field) => (
                          <TableCell key={`${field.id}-${rowIndex}`}>
                            <Skeleton className="h-4 w-24" />
                          </TableCell>
                        ))}
                        <TableCell>
                          <Skeleton className="ml-auto h-8 w-8" />
                        </TableCell>
                      </TableRow>
                    ))
                  : null}

                {!employeesQuery.isPending && paginatedEmployees.length > 0
                  ? paginatedEmployees.map((employee) => (
                      <TableRow key={employee.id}>
                        {visibleColumns.employee ? (
                          <TableCell className="whitespace-normal">
                            <div className="space-y-1">
                              <p className="font-medium">
                                {getEmployeeDisplayName(employee)}
                              </p>
                            </div>
                          </TableCell>
                        ) : null}
                        {visibleColumns.rank ? (
                          <TableCell>{employee.seniorityRank}</TableCell>
                        ) : null}
                        {visibleColumns.designation ? (
                          <TableCell className="whitespace-normal">
                            {getDesignationDisplayValue(employee)}
                          </TableCell>
                        ) : null}
                        {visibleColumns.dateOfBirth ? (
                          <TableCell>
                            {formatDateOnly(employee.dateOfBirth)}
                          </TableCell>
                        ) : null}
                        {visibleColumns.gender ? (
                          <TableCell>{employee.gender}</TableCell>
                        ) : null}
                        {visibleColumns.contactNumber ? (
                          <TableCell>
                            {employee.contactNumber || "Not provided"}
                          </TableCell>
                        ) : null}
                        {visibleColumns.whatsAppNumber ? (
                          <TableCell>
                            {employee.whatsAppNumber || "Not provided"}
                          </TableCell>
                        ) : null}
                        {visibleColumns.panNumber ? (
                          <TableCell>
                            {employee.panNumber || "Not provided"}
                          </TableCell>
                        ) : null}
                        {visibleColumns.pfNumber ? (
                          <TableCell>
                            {employee.pfNumber || "Not provided"}
                          </TableCell>
                        ) : null}
                        {visibleColumns.npsAccountNumber ? (
                          <TableCell>
                            {employee.npsAccountNumber || "Not provided"}
                          </TableCell>
                        ) : null}
                        {visibleCustomFieldColumns.map((field) => {
                          const fieldValue =
                            employee.values[getCustomFieldColumnKey(field.id)] ??
                            "";

                          return (
                            <TableCell key={field.id}>
                              {fieldValue || "Not provided"}
                            </TableCell>
                          );
                        })}
                        {visibleColumns.created ? (
                          <TableCell>{formatDate(employee.createdAt)}</TableCell>
                        ) : null}
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
                                onClick={() =>
                                  navigate(`/employee/${employee.id}/edit`)
                                }
                              >
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  setEmployeePendingDelete(employee)
                                }
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
                      Start by creating a designation in Employee Setup, then
                      add your first employee here.
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
              {deleteEmployeeMutation.isPending
                ? "Deleting..."
                : "Delete employee"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

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

export default function EmployeeIndexPage() {
  const navigate = useNavigate();
  const employeesQuery = useQuery(trpc.employees.list.queryOptions());
  const formOptionsQuery = useQuery(trpc.employees.getCreateFormOptions.queryOptions());
  const employees = employeesQuery.data ?? [];
  const customFieldDefinitions = formOptionsQuery.data?.customFields ?? [];

  const [pageIndex, setPageIndex] = React.useState(0);
  const [visibleColumns, setVisibleColumns] = React.useState<Record<string, boolean>>(
    Object.fromEntries(
      fixedColumnDefinitions.map((column) => [column.key, column.defaultVisible]),
    ),
  );
  const [employeePendingDelete, setEmployeePendingDelete] = React.useState<
    (typeof employees)[number] | null
  >(null);

  const customFieldValueLookupByEmployee = React.useMemo(
    () =>
      new Map(
        employees.map((employee) => [
          employee.id,
          Object.fromEntries(
            employee.customFields.map((field) => [field.fieldDefinitionId, field.value]),
          ),
        ]),
      ),
    [employees],
  );

  const visibleFixedColumns = fixedColumnDefinitions.filter((column) => visibleColumns[column.key]);
  const visibleCustomFieldColumns = customFieldDefinitions.filter((field) =>
    visibleColumns[getCustomFieldColumnKey(field.id)],
  );
  const visibleColumnCount = visibleFixedColumns.length + visibleCustomFieldColumns.length;

  const deleteEmployeeMutation = useMutation(
    trpc.employees.delete.mutationOptions({
      onSuccess: async () => {
        toast.success("Employee deleted");
        setEmployeePendingDelete(null);
        await queryClient.invalidateQueries({
          queryKey: trpc.employees.list.queryKey(),
        });
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  const totalRows = employees.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
  const clampedPageIndex = Math.min(pageIndex, totalPages - 1);
  const pageStart = clampedPageIndex * PAGE_SIZE;
  const paginatedEmployees = employees.slice(pageStart, pageStart + PAGE_SIZE);
  const rangeStart = totalRows === 0 ? 0 : pageStart + 1;
  const rangeEnd = totalRows === 0 ? 0 : Math.min(pageStart + paginatedEmployees.length, totalRows);
  const canGoPrevious = clampedPageIndex > 0;
  const canGoNext = clampedPageIndex < totalPages - 1;

  React.useEffect(() => {
    if (pageIndex !== clampedPageIndex) {
      setPageIndex(clampedPageIndex);
    }
  }, [clampedPageIndex, pageIndex]);

  function toggleColumn(columnKey: string, checked: boolean) {
    setVisibleColumns((current) => ({
      ...current,
      [columnKey]: checked,
    }));
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
                    onCheckedChange={(checked) => toggleColumn(column.key, Boolean(checked))}
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
                          onCheckedChange={(checked) => toggleColumn(columnKey, Boolean(checked))}
                        >
                          {field.label}
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
            {employees.length ? `${employees.length} employee records` : "No employees created yet"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Table aria-label="Employee directory">
            <TableHeader>
              <TableRow>
                {visibleColumns.employee ? <TableHead className="min-w-56">Employee</TableHead> : null}
                {visibleColumns.rank ? <TableHead>Rank</TableHead> : null}
                {visibleColumns.designation ? <TableHead>Designation</TableHead> : null}
                {visibleColumns.dateOfBirth ? <TableHead>Date of Birth</TableHead> : null}
                {visibleColumns.gender ? <TableHead>Gender</TableHead> : null}
                {visibleColumns.contactNumber ? <TableHead>Contact</TableHead> : null}
                {visibleColumns.whatsAppNumber ? <TableHead>WhatsApp</TableHead> : null}
                {visibleColumns.panNumber ? <TableHead>PAN</TableHead> : null}
                {visibleColumns.pfNumber ? <TableHead>PF</TableHead> : null}
                {visibleColumns.npsAccountNumber ? <TableHead>NPS</TableHead> : null}
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
                          <Skeleton className={column.key === "employee" ? "h-4 w-40" : "h-4 w-24"} />
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
                              {employee.surname}, {employee.firstName} {employee.middleName}
                            </p>
                          </div>
                        </TableCell>
                      ) : null}
                      {visibleColumns.rank ? <TableCell>{employee.seniorityRank}</TableCell> : null}
                      {visibleColumns.designation ? (
                        <TableCell className="whitespace-normal">
                          {employee.designationName}
                          {employee.designationIsActive ? "" : " (archived)"}
                        </TableCell>
                      ) : null}
                      {visibleColumns.dateOfBirth ? (
                        <TableCell>{formatDateOnly(employee.dateOfBirth)}</TableCell>
                      ) : null}
                      {visibleColumns.gender ? <TableCell>{employee.gender}</TableCell> : null}
                      {visibleColumns.contactNumber ? (
                        <TableCell>{employee.contactNumber || "Not provided"}</TableCell>
                      ) : null}
                      {visibleColumns.whatsAppNumber ? (
                        <TableCell>{employee.whatsAppNumber || "Not provided"}</TableCell>
                      ) : null}
                      {visibleColumns.panNumber ? (
                        <TableCell>{employee.panNumber || "Not provided"}</TableCell>
                      ) : null}
                      {visibleColumns.pfNumber ? (
                        <TableCell>{employee.pfNumber || "Not provided"}</TableCell>
                      ) : null}
                      {visibleColumns.npsAccountNumber ? (
                        <TableCell>{employee.npsAccountNumber || "Not provided"}</TableCell>
                      ) : null}
                      {visibleCustomFieldColumns.map((field) => {
                        const fieldValue =
                          customFieldValueLookupByEmployee.get(employee.id)?.[field.id] ?? null;

                        return (
                          <TableCell key={field.id}>
                            {fieldValue ? fieldValue : "Not provided"}
                          </TableCell>
                        );
                      })}
                      {visibleColumns.created ? (
                        <TableCell>{formatDate(employee.createdAt)}</TableCell>
                      ) : null}
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={<Button variant="ghost" size="icon-sm" aria-label="Employee actions" />}
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
            </TableBody>
          </Table>

          {!employeesQuery.isPending && totalRows > 0 ? (
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
                      onClick={() => setPageIndex((current) => Math.min(current + 1, totalPages - 1))}
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

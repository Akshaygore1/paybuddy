import * as React from "react";
import { Button } from "@tds-nivaran/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@tds-nivaran/ui/components/card";
import { Field, FieldError, FieldLabel } from "@tds-nivaran/ui/components/field";
import { Input } from "@tds-nivaran/ui/components/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@tds-nivaran/ui/components/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@tds-nivaran/ui/components/table";
import { Badge } from "@tds-nivaran/ui/components/badge";
import { DownloadIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { usePayrollWorkspace } from "@/hooks/use-payroll-workspace";
import { financialYearOptions, getFinancialYearLabel } from "@/lib/financial-year";
import {
  formatPaiseForDisplay,
  parsePayrollInputToPaise,
  removeMoneyGrouping,
} from "@/lib/payroll-money";
import { downloadPayrollDocument } from "@/lib/payroll-document";
import { buildPayrollPdfTableModel } from "@/lib/payroll-pdf";
import {
  getPayrollLineItemKey as getLineItemKey,
  type PayrollLineItemState,
  type PayrollSection,
} from "@/lib/payroll-workspace";

const sectionLabels: Record<PayrollSection, string> = {
  earnings: "Earnings",
  deductions: "Deductions",
};

function buildFinancialYearMonths(financialYearStart: number) {
  return Array.from({ length: 12 }, (_, index) => {
    const monthIndex = (3 + index) % 12;
    const year = index < 9 ? financialYearStart : financialYearStart + 1;
    const date = new Date(Date.UTC(year, monthIndex, 1));

    return {
      value: `${year}-${String(monthIndex + 1).padStart(2, "0")}`,
      label: new Intl.DateTimeFormat("en-IN", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }).format(date),
      shortLabel: new Intl.DateTimeFormat("en-IN", {
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }).format(date),
      year,
      monthIndex,
    };
  });
}

function formatCurrency(amountPaise: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(amountPaise / 100);
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function calculateTotals(lineItems: PayrollLineItemState[]) {
  const totals = { earningsPaise: 0, deductionsPaise: 0, netPayPaise: 0 };

  for (const item of lineItems) {
    const amountPaise = parsePayrollInputToPaise(item.amount);

    if (!Number.isFinite(amountPaise)) {
      continue;
    }

    if (item.section === "earnings") {
      totals.earningsPaise += amountPaise;
    } else {
      totals.deductionsPaise += amountPaise;
    }
  }

  totals.netPayPaise = totals.earningsPaise - totals.deductionsPaise;
  return totals;
}

function PayrollTable({
  section,
  lineItems,
  onAmountChange,
  onAmountBlur,
  onAddField,
  onArchiveField,
  selectedMonthLabel,
  previousMonthLabel,
  previousMonthAmounts,
  isAddFieldPending,
  isArchivingField,
}: {
  section: PayrollSection;
  lineItems: PayrollLineItemState[];
  onAmountChange: (lineItemKey: string, value: string) => void;
  onAmountBlur: (lineItemKey: string) => void;
  onAddField: (section: PayrollSection, label: string) => Promise<string | null>;
  onArchiveField: (fieldId: string) => Promise<void>;
  selectedMonthLabel: string;
  previousMonthLabel: string | null;
  previousMonthAmounts: ReadonlyMap<string, number>;
  isAddFieldPending: boolean;
  isArchivingField: boolean;
}) {
  const [isAddFieldFormOpen, setIsAddFieldFormOpen] = React.useState(false);
  const [fieldLabel, setFieldLabel] = React.useState("");
  const [fieldError, setFieldError] = React.useState<string | null>(null);
  const [lineItemKeyToFocus, setLineItemKeyToFocus] = React.useState<string | null>(null);
  const [focusedAmountKey, setFocusedAmountKey] = React.useState<string | null>(null);
  const fieldNameInputRef = React.useRef<HTMLInputElement>(null);
  const amountInputRefs = React.useRef(new Map<string, HTMLInputElement>());
  const visibleItems = lineItems.filter((item) => item.section === section);
  const totalPaise = visibleItems.reduce((total, item) => {
    const amountPaise = parsePayrollInputToPaise(item.amount);
    return total + (Number.isFinite(amountPaise) ? amountPaise : 0);
  }, 0);

  React.useEffect(() => {
    if (isAddFieldFormOpen) {
      fieldNameInputRef.current?.focus();
    }
  }, [isAddFieldFormOpen]);

  React.useEffect(() => {
    if (!lineItemKeyToFocus) {
      return;
    }

    const input = amountInputRefs.current.get(lineItemKeyToFocus);
    if (input) {
      input.focus();
      setLineItemKeyToFocus(null);
    }
  }, [lineItemKeyToFocus, visibleItems]);

  function closeAddFieldForm() {
    setIsAddFieldFormOpen(false);
    setFieldLabel("");
    setFieldError(null);
  }

  async function submitField(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedLabel = fieldLabel.trim();

    if (!normalizedLabel) {
      setFieldError("Field name is required");
      return;
    }

    if (normalizedLabel.length > 120) {
      setFieldError("Field name must be 120 characters or fewer");
      return;
    }

    try {
      const lineItemKey = await onAddField(section, normalizedLabel);
      if (!lineItemKey) {
        return;
      }

      closeAddFieldForm();
      setLineItemKeyToFocus(lineItemKey);
    } catch (error) {
      setFieldError(error instanceof Error ? error.message : "Unable to add payroll field");
    }
  }

  async function removeField(field: PayrollLineItemState) {
    if (
      !field.customFieldDefinitionId ||
      !window.confirm(`Remove ‘${field.label}’ from ${selectedMonthLabel} onward?`)
    ) {
      return;
    }

    try {
      await onArchiveField(field.customFieldDefinitionId);
    } catch {
      // The mutation displays the server error as a toast.
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="min-w-0 space-y-1.5">
          <CardTitle>{sectionLabels[section]}</CardTitle>
          <CardDescription>
            Monthly {sectionLabels[section].toLowerCase()} for the selected financial year.
          </CardDescription>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0"
          aria-expanded={isAddFieldFormOpen}
          onClick={() => {
            if (isAddFieldFormOpen) {
              closeAddFieldForm();
            } else {
              setIsAddFieldFormOpen(true);
            }
          }}
        >
          <PlusIcon data-icon="inline-start" />
          Add field
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {isAddFieldFormOpen ? (
          <form
            className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-start"
            onSubmit={submitField}
          >
            <Field className="min-w-0 flex-1" data-invalid={Boolean(fieldError) || undefined}>
              <FieldLabel htmlFor={`${section}-field-name`}>Field name</FieldLabel>
              <Input
                ref={fieldNameInputRef}
                id={`${section}-field-name`}
                value={fieldLabel}
                aria-invalid={Boolean(fieldError)}
                aria-describedby={fieldError ? `${section}-field-name-error` : undefined}
                placeholder={section === "earnings" ? "Allowance name" : "Deduction name"}
                onChange={(event) => {
                  setFieldLabel(event.target.value);
                  setFieldError(null);
                }}
              />
              <FieldError id={`${section}-field-name-error`}>{fieldError}</FieldError>
            </Field>
            <div className="flex gap-2 sm:pt-6">
              <Button type="submit" size="sm" disabled={isAddFieldPending}>
                {isAddFieldPending ? "Adding..." : "Add"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={isAddFieldPending}
                onClick={closeAddFieldForm}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : null}
        <Table aria-label={`${sectionLabels[section]} payroll fields`}>
          <TableHeader>
            <TableRow>
              <TableHead>Field</TableHead>
              <TableHead className="w-44 text-right">
                {previousMonthLabel ? `Previous month (${previousMonthLabel})` : "Previous month"}
              </TableHead>
              <TableHead className="w-48 text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleItems.map((item) => {
              const key = getLineItemKey(item);
              const invalidAmount = item.amount.trim()
                ? Number.isNaN(parsePayrollInputToPaise(item.amount))
                : false;

              return (
                <TableRow key={key}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span>{item.label}</span>
                      {item.isArchivedCustomField ? (
                        <Badge variant="outline">Archived</Badge>
                      ) : null}
                      {item.customFieldDefinitionId && !item.isArchivedCustomField ? (
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          className="text-muted-foreground"
                          aria-label={`Remove ${item.label}`}
                          disabled={isArchivingField}
                          onClick={() => void removeField(item)}
                        >
                          <Trash2Icon />
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums text-muted-foreground">
                    {previousMonthAmounts.has(key)
                      ? formatPaiseForDisplay(previousMonthAmounts.get(key) ?? 0)
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <Input
                      ref={(input) => {
                        if (input) {
                          amountInputRefs.current.set(key, input);
                        } else {
                          amountInputRefs.current.delete(key);
                        }
                      }}
                      aria-label={`${item.label} amount`}
                      inputMode="decimal"
                      className="text-right"
                      value={
                        focusedAmountKey === key ? removeMoneyGrouping(item.amount) : item.amount
                      }
                      aria-invalid={invalidAmount}
                      onFocus={() => setFocusedAmountKey(key)}
                      onChange={(event) => onAmountChange(key, event.target.value)}
                      onBlur={() => {
                        setFocusedAmountKey(null);
                        onAmountBlur(key);
                      }}
                      placeholder="0.00"
                    />
                    {invalidAmount ? (
                      <p className="mt-1 text-right text-xs text-destructive">
                        Enter a valid amount.
                      </p>
                    ) : null}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <div className="flex items-center justify-between border-t pt-3 text-sm">
          <span className="font-medium">Total {sectionLabels[section]}</span>
          <span className="font-semibold">{formatCurrency(totalPaise)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PayrollIndexPage() {
  const workspace = usePayrollWorkspace();
  const {
    state: { financialYearStart, employeeId: selectedEmployeeId, month: selectedMonth, lineItems },
    validation: { hasInvalidAmounts, canDownload },
    employeesQuery,
    formQuery,
    saveMutation: savePayrollMutation,
    addCustomFieldMutation,
    archiveCustomFieldMutation,
    updateAmount,
    formatAmount,
    addCustomField,
    archiveCustomField,
  } = workspace;

  const months = React.useMemo(
    () => buildFinancialYearMonths(financialYearStart),
    [financialYearStart],
  );
  const selectedMonthDefinition =
    months.find((month) => month.value === selectedMonth) ?? months[0];
  const selectedMonthIndex = months.findIndex((month) => month.value === selectedMonth);
  const previousMonthDefinition = selectedMonthIndex > 0 ? months[selectedMonthIndex - 1] : null;
  const previousMonthAmounts = React.useMemo(() => {
    if (!previousMonthDefinition || !formQuery.data) {
      return new Map<string, number>();
    }

    const previousPayroll = formQuery.data.monthlyPayroll.find(
      (payroll) => payroll.month === previousMonthDefinition.value,
    );

    return new Map(
      (previousPayroll?.lineItems ?? []).map((item) => [getLineItemKey(item), item.amountPaise]),
    );
  }, [formQuery.data, previousMonthDefinition]);
  const employeeLabelById = React.useMemo(
    () =>
      Object.fromEntries(
        (employeesQuery.data ?? []).map((employee) => [
          employee.id,
          [employee.firstName, employee.middleName, employee.surname].filter(Boolean).join(" "),
        ]),
      ),
    [employeesQuery.data],
  );
  const totals = React.useMemo(() => calculateTotals(lineItems), [lineItems]);

  function requireSavedPayroll() {
    if (!formQuery.data?.hasSavedPayroll) {
      toast.error("Save payroll before downloading a payslip");
      return false;
    }

    if (!canDownload) {
      toast.error("Save payroll changes before downloading a payslip");
      return false;
    }

    return true;
  }

  async function downloadPdf(kind: "monthly" | "annual") {
    if (!formQuery.data || !requireSavedPayroll()) {
      return;
    }

    const savedLineItems = lineItems
      .filter((item) => !item.isArchivedCustomField)
      .map((item) => {
        const amountPaise = parsePayrollInputToPaise(item.amount);

        return {
          ...item,
          amountPaise: Number.isFinite(amountPaise) ? amountPaise : 0,
        };
      });
    const tableModel = buildPayrollPdfTableModel({
      kind,
      financialYearLabel: getFinancialYearLabel(financialYearStart),
      selectedMonthValue: selectedMonth,
      selectedMonthLabel: selectedMonthDefinition.shortLabel,
      months: months.map((month) => ({
        value: month.value,
        label: month.label,
        shortLabel: month.shortLabel,
        lineItems:
          formQuery.data.monthlyPayroll
            .find((payroll) => payroll.month === month.value)
            ?.lineItems.map((item) => ({
              section: item.section,
              fixedFieldKey: item.fixedFieldKey,
              customFieldDefinitionId: item.customFieldDefinitionId,
              label: item.label,
              amountPaise: item.amountPaise,
              sortOrder: item.sortOrder,
            })) ?? [],
      })),
      lineItems: savedLineItems.map((item) => ({
        section: item.section,
        fixedFieldKey: item.fixedFieldKey,
        customFieldDefinitionId: item.customFieldDefinitionId,
        label: item.label,
        amountPaise: item.amountPaise,
        sortOrder: item.sortOrder,
      })),
      institution: {
        name: formQuery.data.institution.name,
        address: formQuery.data.institution.address,
        tanNumber: formQuery.data.institution.tanNumber,
      },
      employee: {
        name: formQuery.data.employee.name,
      },
    });
    const employeeSlug = slugify(formQuery.data.employee.name);
    const fileName =
      kind === "monthly"
        ? `payslip-${employeeSlug}-${slugify(selectedMonthDefinition.shortLabel)}.pdf`
        : `annual-payslip-${employeeSlug}-${getFinancialYearLabel(financialYearStart)}.pdf`;
    await downloadPayrollDocument({ tableModel, fileName });
  }

  return (
    <section className="space-y-6 p-6">
      <PageHeader
        title="Payroll"
        description="Prepare monthly payroll and download employee payslips for the selected financial year."
      />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Payroll period</CardTitle>
            {selectedEmployeeId ? (
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void downloadPdf("monthly")}
                  disabled={formQuery.isFetching}
                >
                  <DownloadIcon data-icon="inline-start" />
                  Download Monthly Payslip
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void downloadPdf("annual")}
                  disabled={formQuery.isFetching}
                >
                  <DownloadIcon data-icon="inline-start" />
                  Download Annual Payslip
                </Button>
              </div>
            ) : null}
          </div>
          <CardDescription>
            Select an employee to load payroll for the chosen financial year.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-[1fr_220px_220px]">
            <Field>
              <FieldLabel>Employee</FieldLabel>
              <Select
                value={selectedEmployeeId}
                onValueChange={(value) => {
                  const nextEmployeeId = value ?? "";
                  workspace.selectEmployee(nextEmployeeId);
                }}
              >
                <SelectTrigger aria-label="Select employee">
                  <SelectValue placeholder="Select employee">
                    {selectedEmployeeId
                      ? (employeeLabelById[selectedEmployeeId] ?? "Select employee")
                      : "Select employee"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {(employeesQuery.data ?? []).map((employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {employeeLabelById[employee.id]}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>Financial year</FieldLabel>
              <Select
                value={String(financialYearStart)}
                onValueChange={workspace.selectFinancialYear}
              >
                <SelectTrigger aria-label="Select payroll financial year">
                  <SelectValue placeholder="Select financial year">
                    {getFinancialYearLabel(financialYearStart)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {financialYearOptions.map((yearStart) => (
                      <SelectItem key={yearStart} value={String(yearStart)}>
                        {getFinancialYearLabel(yearStart)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>Month</FieldLabel>
              <Select
                value={selectedMonth}
                onValueChange={(value) => {
                  if (value) workspace.selectMonth(value);
                }}
              >
                <SelectTrigger aria-label="Select payroll month">
                  <SelectValue placeholder="Select month">
                    {selectedMonthDefinition.label}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {months.map((month) => (
                      <SelectItem key={month.value} value={month.value}>
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </div>
        </CardContent>
      </Card>

      {selectedEmployeeId ? (
        <div className="space-y-6">
          <div className="space-y-3">
            <div className="grid gap-6 xl:grid-cols-2">
              <PayrollTable
                section="earnings"
                lineItems={lineItems}
                onAmountChange={updateAmount}
                onAmountBlur={formatAmount}
                onAddField={addCustomField}
                onArchiveField={archiveCustomField}
                selectedMonthLabel={selectedMonthDefinition.label}
                previousMonthLabel={previousMonthDefinition?.shortLabel ?? null}
                previousMonthAmounts={previousMonthAmounts}
                isAddFieldPending={addCustomFieldMutation.isPending}
                isArchivingField={archiveCustomFieldMutation.isPending}
              />
              <PayrollTable
                section="deductions"
                lineItems={lineItems}
                onAmountChange={updateAmount}
                onAmountBlur={formatAmount}
                onAddField={addCustomField}
                onArchiveField={archiveCustomField}
                selectedMonthLabel={selectedMonthDefinition.label}
                previousMonthLabel={previousMonthDefinition?.shortLabel ?? null}
                previousMonthAmounts={previousMonthAmounts}
                isAddFieldPending={addCustomFieldMutation.isPending}
                isArchivingField={archiveCustomFieldMutation.isPending}
              />
            </div>
            <div className="space-y-1 px-4 py-2">
              <p className="text-xs text-muted-foreground">Net pay</p>
              <p className="text-lg font-semibold tabular-nums">
                {formatCurrency(totals.netPayPaise)}
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              onClick={() => void workspace.save()}
              disabled={savePayrollMutation.isPending || hasInvalidAmounts}
            >
              {savePayrollMutation.isPending ? "Saving..." : "Save Payroll"}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

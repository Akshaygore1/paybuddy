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

import { authClient } from "@/lib/auth-client";
import { useConfirmModal } from "@/components/confirm-modal";
import { PageHeader } from "@/components/page-header";
import { usePayrollWorkspace } from "@/hooks/use-payroll-workspace";
import { formatIndianCurrencyFromPaise } from "@/lib/display-formatters";
import { formatPaiseForDisplay, removeMoneyGrouping } from "@/lib/payroll-money";
import {
  getPayrollLineItemKey as getLineItemKey,
  type PayrollLineItemView,
  type PayrollSection,
} from "@/lib/payroll-workspace";

const sectionLabels: Record<PayrollSection, string> = {
  earnings: "Earnings",
  deductions: "Deductions",
};

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
  totalPaise,
  isAddFieldPending,
  isArchivingField,
  isAdmin,
}: {
  section: PayrollSection;
  lineItems: PayrollLineItemView[];
  onAmountChange: (lineItemKey: string, value: string) => void;
  onAmountBlur: (lineItemKey: string) => void;
  onAddField: (section: PayrollSection, label: string) => Promise<string | null>;
  onArchiveField: (fieldId: string) => Promise<void>;
  selectedMonthLabel: string;
  previousMonthLabel: string | null;
  previousMonthAmounts: ReadonlyMap<string, number>;
  totalPaise: number;
  isAddFieldPending: boolean;
  isArchivingField: boolean;
  isAdmin: boolean;
}) {
  const [isAddFieldFormOpen, setIsAddFieldFormOpen] = React.useState(false);
  const [fieldLabel, setFieldLabel] = React.useState("");
  const [fieldError, setFieldError] = React.useState<string | null>(null);
  const [lineItemKeyToFocus, setLineItemKeyToFocus] = React.useState<string | null>(null);
  const [focusedAmountKey, setFocusedAmountKey] = React.useState<string | null>(null);
  const fieldNameInputRef = React.useRef<HTMLInputElement>(null);
  const amountInputRefs = React.useRef(new Map<string, HTMLInputElement>());
  const visibleItems = lineItems.filter((item) => item.section === section);
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

  const confirmModal = useConfirmModal();

  async function removeField(field: PayrollLineItemView) {
    if (!field.customFieldDefinitionId) {
      return;
    }

    const confirmed = await confirmModal({
      title: "Remove Payroll Field",
      description: `Remove ‘${field.label}’ from ${selectedMonthLabel} onward?`,
      confirmText: "Remove Field",
      variant: "destructive",
    });

    if (!confirmed) {
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

              return (
                <TableRow key={key}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span>{item.label}</span>
                      {item.isArchivedCustomField ? (
                        <Badge variant="outline">Archived</Badge>
                      ) : null}
                      {item.customFieldDefinitionId && !item.isArchivedCustomField && isAdmin ? (
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
                      aria-invalid={item.isInvalidAmount}
                      onFocus={() => setFocusedAmountKey(key)}
                      onChange={(event) => onAmountChange(key, event.target.value)}
                      onBlur={() => {
                        setFocusedAmountKey(null);
                        onAmountBlur(key);
                      }}
                      placeholder="0.00"
                    />
                    {item.isInvalidAmount ? (
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
          <span className="font-semibold">{formatIndianCurrencyFromPaise(totalPaise)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PayrollIndexPage() {
  const { data: session } = authClient.useSession();
  const isAdmin = session?.user.role === "admin";
  const {
    view: {
      selection: {
        financialYearStart,
        financialYearLabel,
        employeeId: selectedEmployeeId,
        month: selectedMonth,
        selectedMonth: selectedMonthDefinition,
        previousMonth: previousMonthDefinition,
      },
      months,
      financialYears,
      employees,
      employeeLabelById,
      lineItems,
      previousMonthAmounts,
      totals,
      capabilities: { hasInvalidAmounts },
    },
    status,
    actions,
  } = usePayrollWorkspace();

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
                  onClick={() => void actions.downloadMonthly()}
                  disabled={status.form.isFetching || status.download.isPending}
                >
                  <DownloadIcon data-icon="inline-start" />
                  Download Monthly Payslip
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void actions.downloadAnnual()}
                  disabled={status.form.isFetching || status.download.isPending}
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
                  actions.selectEmployee(nextEmployeeId);
                }}
              >
                <SelectTrigger aria-label="Select employee">
                  <SelectValue placeholder="Select Employee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {employees.map((employee) => (
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
                onValueChange={actions.selectFinancialYear}
              >
                <SelectTrigger aria-label="Select payroll financial year">
                  <SelectValue placeholder="Select financial year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {financialYears.map((financialYear) => (
                      <SelectItem key={financialYear.value} value={String(financialYear.value)}>
                        {financialYear.label}
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
                  if (value) actions.selectMonth(value);
                }}
              >
                <SelectTrigger aria-label="Select payroll month">
                  <SelectValue placeholder="Select month" />
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
                onAmountChange={actions.updateAmount}
                onAmountBlur={actions.formatAmount}
                onAddField={actions.addCustomField}
                onArchiveField={actions.archiveCustomField}
                selectedMonthLabel={selectedMonthDefinition.label}
                previousMonthLabel={previousMonthDefinition?.shortLabel ?? null}
                previousMonthAmounts={previousMonthAmounts}
                totalPaise={totals.earningsPaise}
                isAddFieldPending={status.addField.isPending}
                isArchivingField={status.archiveField.isPending}
                isAdmin={isAdmin}
              />
              <PayrollTable
                section="deductions"
                lineItems={lineItems}
                onAmountChange={actions.updateAmount}
                onAmountBlur={actions.formatAmount}
                onAddField={actions.addCustomField}
                onArchiveField={actions.archiveCustomField}
                selectedMonthLabel={selectedMonthDefinition.label}
                previousMonthLabel={previousMonthDefinition?.shortLabel ?? null}
                previousMonthAmounts={previousMonthAmounts}
                totalPaise={totals.deductionsPaise}
                isAddFieldPending={status.addField.isPending}
                isArchivingField={status.archiveField.isPending}
                isAdmin={isAdmin}
              />
            </div>
            <div className="space-y-1 px-4 py-2">
              <p className="text-xs text-muted-foreground">Net pay</p>
              <p className="text-lg font-semibold tabular-nums">
                {formatIndianCurrencyFromPaise(totals.netPayPaise)}
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              onClick={() => void actions.save()}
              disabled={status.save.isPending || hasInvalidAmounts}
            >
              {status.save.isPending ? "Saving..." : "Save Payroll"}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

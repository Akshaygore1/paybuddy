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
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@paybuddy/ui/components/field";
import { Input } from "@paybuddy/ui/components/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@paybuddy/ui/components/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@paybuddy/ui/components/table";
import { Badge } from "@paybuddy/ui/components/badge";
import { useMutation, useQuery } from "@tanstack/react-query";
import { DownloadIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import {
  financialYearChangeEvent,
  financialYearOptions,
  getFinancialYearLabel,
  readSelectedFinancialYearStart,
  type FinancialYearStart,
  writeSelectedFinancialYearStart,
} from "@/lib/financial-year";
import {
  buildPayrollPdfTableModel,
  formatPayrollPdfCurrency,
} from "@/lib/payroll-pdf";
import { queryClient, trpc } from "@/utils/trpc";

type PayrollSection = "earnings" | "deductions";

type PayrollLineItemState = {
  section: PayrollSection;
  fixedFieldKey: string | null;
  customFieldDefinitionId: string | null;
  label: string;
  amount: string;
  sortOrder: number;
  isArchivedCustomField?: boolean;
};

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

function getCurrentFinancialYearMonth(financialYearStart: number) {
  const months = buildFinancialYearMonths(financialYearStart);
  const now = new Date();
  const currentValue = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  return months.some((month) => month.value === currentValue)
    ? currentValue
    : months[0].value;
}

function getLineItemKey(item: {
  fixedFieldKey: string | null;
  customFieldDefinitionId: string | null;
  section: PayrollSection;
}) {
  return item.fixedFieldKey
    ? `${item.section}:fixed:${item.fixedFieldKey}`
    : `${item.section}:custom:${item.customFieldDefinitionId}`;
}

function paiseToInput(amountPaise: number) {
  if (amountPaise === 0) {
    return "";
  }

  return `${Math.floor(amountPaise / 100)}.${String(amountPaise % 100).padStart(2, "0")}`;
}

function parseInputToPaise(value: string) {
  const normalized = value.trim();

  if (!normalized) {
    return 0;
  }

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return Number.NaN;
  }

  const [rupeesText, paiseText = ""] = normalized.split(".");
  return Number(rupeesText) * 100 + Number(paiseText.padEnd(2, "0"));
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
    const amountPaise = parseInputToPaise(item.amount);

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

function createLineItemsFromForm(
  form: NonNullable<ReturnType<typeof useQuery>["data"]>,
) {
  const data = form as {
    lineItems: Array<{
      section: PayrollSection;
      fixedFieldKey: string | null;
      customFieldDefinitionId: string | null;
      label: string;
      amountPaise: number;
      sortOrder: number;
      isArchivedCustomField?: boolean;
    }>;
  };

  return data.lineItems.map((item) => ({
    section: item.section,
    fixedFieldKey: item.fixedFieldKey,
    customFieldDefinitionId: item.customFieldDefinitionId,
    label: item.label,
    amount: paiseToInput(item.amountPaise),
    sortOrder: item.sortOrder,
    isArchivedCustomField: item.isArchivedCustomField,
  }));
}

function PayrollTable({
  section,
  lineItems,
  onAmountChange,
}: {
  section: PayrollSection;
  lineItems: PayrollLineItemState[];
  onAmountChange: (lineItemKey: string, value: string) => void;
}) {
  const visibleItems = lineItems.filter((item) => item.section === section);
  const totalPaise = visibleItems.reduce((total, item) => {
    const amountPaise = parseInputToPaise(item.amount);
    return total + (Number.isFinite(amountPaise) ? amountPaise : 0);
  }, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{sectionLabels[section]}</CardTitle>
        <CardDescription>
          Monthly {sectionLabels[section].toLowerCase()} for the selected
          financial year.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Table aria-label={`${sectionLabels[section]} payroll fields`}>
          <TableHeader>
            <TableRow>
              <TableHead>Field</TableHead>
              <TableHead className="w-48 text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleItems.map((item) => {
              const key = getLineItemKey(item);
              const invalidAmount = item.amount.trim()
                ? Number.isNaN(parseInputToPaise(item.amount))
                : false;

              return (
                <TableRow key={key}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span>{item.label}</span>
                      {item.isArchivedCustomField ? (
                        <Badge variant="outline">Archived</Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Input
                      aria-label={`${item.label} amount`}
                      inputMode="decimal"
                      className="text-right"
                      value={item.amount}
                      aria-invalid={invalidAmount}
                      onChange={(event) =>
                        onAmountChange(key, event.target.value)
                      }
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
  const [financialYearStart, setFinancialYearStart] =
    React.useState<FinancialYearStart>(() => readSelectedFinancialYearStart());
  const [selectedEmployeeId, setSelectedEmployeeId] = React.useState("");
  const [selectedMonth, setSelectedMonth] = React.useState(() =>
    getCurrentFinancialYearMonth(readSelectedFinancialYearStart()),
  );
  const [formKey, setFormKey] = React.useState<{
    employeeId: string;
    financialYearStart: FinancialYearStart;
  } | null>(null);
  const [lineItems, setLineItems] = React.useState<PayrollLineItemState[]>([]);
  const [customFieldSection, setCustomFieldSection] =
    React.useState<PayrollSection>("earnings");
  const [customFieldLabel, setCustomFieldLabel] = React.useState("");
  const [customFieldError, setCustomFieldError] = React.useState<string | null>(
    null,
  );
  const [isDirty, setIsDirty] = React.useState(false);

  const employeesQuery = useQuery(trpc.payroll.getEmployees.queryOptions());
  const formQuery = useQuery({
    ...trpc.payroll.getForm.queryOptions(
      formKey
        ? {
            employeeId: formKey.employeeId,
            financialYearStart: formKey.financialYearStart,
          }
        : {
            employeeId: "__pending__",
            financialYearStart,
          },
    ),
    enabled: Boolean(formKey),
  });

  const savePayrollMutation = useMutation(
    trpc.payroll.save.mutationOptions({
      onSuccess: async (data) => {
        setLineItems(createLineItemsFromForm(data));
        setIsDirty(false);
        toast.success("Payroll saved");
        await queryClient.invalidateQueries({
          queryKey: trpc.payroll.getForm.queryKey({
            employeeId: data.employee.id,
            financialYearStart: data.financialYearStart,
          }),
        });
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const addCustomFieldMutation = useMutation(
    trpc.payroll.addCustomField.mutationOptions({
      onSuccess: async () => {
        toast.success("Payroll field added");
        setCustomFieldLabel("");
        setCustomFieldError(null);
        await queryClient.invalidateQueries();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const archiveCustomFieldMutation = useMutation(
    trpc.payroll.archiveCustomField.mutationOptions({
      onSuccess: async () => {
        toast.success("Payroll field archived");
        await queryClient.invalidateQueries();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const months = React.useMemo(
    () => buildFinancialYearMonths(financialYearStart),
    [financialYearStart],
  );
  const selectedMonthDefinition =
    months.find((month) => month.value === selectedMonth) ?? months[0];
  const selectedEmployee = employeesQuery.data?.find(
    (employee) => employee.id === selectedEmployeeId,
  );
  const employeeLabelById = React.useMemo(
    () =>
      Object.fromEntries(
        (employeesQuery.data ?? []).map((employee) => [
          employee.id,
          [employee.firstName, employee.middleName, employee.surname]
            .filter(Boolean)
            .join(" "),
        ]),
      ),
    [employeesQuery.data],
  );
  const totals = React.useMemo(() => calculateTotals(lineItems), [lineItems]);
  const hasInvalidAmounts = lineItems.some(
    (item) =>
      item.amount.trim() && Number.isNaN(parseInputToPaise(item.amount)),
  );

  React.useEffect(() => {
    function syncFinancialYear(event: Event) {
      const customEvent = event as CustomEvent<{
        financialYearStart: FinancialYearStart;
      }>;
      const nextFinancialYearStart =
        customEvent.detail?.financialYearStart ??
        readSelectedFinancialYearStart();

      setFinancialYearStart(nextFinancialYearStart);
      setSelectedMonth(getCurrentFinancialYearMonth(nextFinancialYearStart));
      setFormKey(null);
      setLineItems([]);
      setIsDirty(false);
    }

    window.addEventListener(financialYearChangeEvent, syncFinancialYear);
    return () =>
      window.removeEventListener(financialYearChangeEvent, syncFinancialYear);
  }, []);

  React.useEffect(() => {
    if (formQuery.data) {
      setLineItems(createLineItemsFromForm(formQuery.data));
      setIsDirty(false);
    }
  }, [formQuery.data]);

  function updateFinancialYear(value: string | null) {
    const nextFinancialYearStart = Number(value) as FinancialYearStart;

    if (!financialYearOptions.includes(nextFinancialYearStart)) {
      return;
    }

    setFinancialYearStart(nextFinancialYearStart);
    setSelectedMonth(getCurrentFinancialYearMonth(nextFinancialYearStart));
    setFormKey(null);
    setLineItems([]);
    setIsDirty(false);
    writeSelectedFinancialYearStart(nextFinancialYearStart);
  }

  function showPayrollForm() {
    if (!selectedEmployeeId) {
      toast.error("Select an employee first");
      return;
    }

    setFormKey({ employeeId: selectedEmployeeId, financialYearStart });
  }

  function updateAmount(lineItemKey: string, value: string) {
    setLineItems((current) =>
      current.map((item) =>
        getLineItemKey(item) === lineItemKey
          ? {
              ...item,
              amount: value,
            }
          : item,
      ),
    );
    setIsDirty(true);
  }

  async function savePayroll() {
    if (!formKey || hasInvalidAmounts) {
      if (hasInvalidAmounts) {
        toast.error("Fix invalid payroll amounts before saving");
      }
      return;
    }

    await savePayrollMutation.mutateAsync({
      employeeId: formKey.employeeId,
      financialYearStart: formKey.financialYearStart,
      lineItems: lineItems
        .filter((item) => !item.isArchivedCustomField)
        .map((item) => ({
          section: item.section,
          fixedFieldKey: item.fixedFieldKey,
          customFieldDefinitionId: item.customFieldDefinitionId,
          amount: item.amount.trim() || "0",
        })),
    });
  }

  async function addCustomField(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedLabel = customFieldLabel.trim();

    if (!normalizedLabel) {
      setCustomFieldError("Field label is required");
      return;
    }

    await addCustomFieldMutation.mutateAsync({
      section: customFieldSection,
      label: normalizedLabel,
    });
  }

  async function archiveCustomField(fieldId: string) {
    await archiveCustomFieldMutation.mutateAsync({ id: fieldId });
  }

  function requireSavedPayroll() {
    if (!formQuery.data?.hasSavedPayroll) {
      toast.error("Save payroll before downloading a payslip");
      return false;
    }

    if (isDirty) {
      toast.error("Save payroll changes before downloading a payslip");
      return false;
    }

    return true;
  }

  async function downloadPdf(kind: "monthly" | "annual") {
    if (!formQuery.data || !requireSavedPayroll()) {
      return;
    }

    const { Document, Page, Text, View, StyleSheet, pdf } =
      await import("@react-pdf/renderer");
    const savedLineItems = lineItems
      .filter((item) => !item.isArchivedCustomField)
      .map((item) => {
        const amountPaise = parseInputToPaise(item.amount);

        return {
          ...item,
          amountPaise: Number.isFinite(amountPaise) ? amountPaise : 0,
        };
      });
    const tableModel = buildPayrollPdfTableModel({
      kind,
      financialYearLabel: getFinancialYearLabel(financialYearStart),
      selectedMonthLabel: selectedMonthDefinition.shortLabel,
      months: months.map((month) => ({
        value: month.value,
        label: month.label,
        shortLabel: month.shortLabel,
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
    const styles = StyleSheet.create({
      page: {
        paddingTop: 16,
        paddingRight: 18,
        paddingBottom: 20,
        paddingLeft: 18,
        fontSize: 6,
        fontFamily: "Helvetica",
        color: "#111111",
      },
      headerBlock: {
        alignItems: "center",
        borderBottom: "1px solid #9ca3af",
        paddingTop: 4,
        paddingBottom: 8,
        marginBottom: 10,
      },
      institutionName: {
        textAlign: "center",
        fontSize: 12,
        fontWeight: 700,
        marginBottom: 2,
      },
      institutionAddress: {
        textAlign: "center",
        fontSize: 7,
        marginBottom: 2,
      },
      institutionTan: {
        textAlign: "center",
        fontSize: 6.5,
        color: "#4b5563",
        marginBottom: 5,
      },
      title: {
        textAlign: "center",
        fontSize: 9.5,
        fontWeight: 700,
        letterSpacing: 0.2,
        marginBottom: 8,
      },
      headerMetaRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        gap: 10,
        width: "100%",
        borderTop: "1px solid #d1d5db",
        paddingTop: 6,
      },
      metaColumn: {
        width: "48%",
      },
      metaText: {
        fontSize: 6.5,
        marginBottom: 2,
      },
      metaLabel: {
        fontWeight: 700,
      },
      tableWrap: {
        alignSelf: "center",
        borderTop: "1px solid #94a3b8",
        borderLeft: "1px solid #94a3b8",
      },
      tableHeaderRow: {
        flexDirection: "row",
        backgroundColor: "#dbe4f0",
      },
      tableRow: {
        flexDirection: "row",
      },
      alternateRow: {
        backgroundColor: "#f8fafc",
      },
      cell: {
        paddingTop: 3,
        paddingRight: 3,
        paddingBottom: 3,
        paddingLeft: 3,
        borderRight: "1px solid #94a3b8",
        borderBottom: "1px solid #94a3b8",
        justifyContent: "center",
      },
      headerCellText: {
        fontSize: 5.5,
        fontWeight: 700,
        textAlign: "center",
        lineHeight: 1.2,
      },
      bodyCellText: {
        fontSize: 5.7,
        lineHeight: 1.2,
      },
      totalRow: {
        backgroundColor: "#e2e8f0",
      },
    });
    const institutionName =
      tableModel.header.leftLines[0]?.replace(/^School:\s*/u, "") ?? "";
    const institutionAddress =
      tableModel.header.leftLines[1]?.replace(/^Address:\s*/u, "") ?? "";
    const institutionTan =
      tableModel.header.leftLines[2]?.replace(/^TAN No\.\s*:\s*/u, "") ?? "";
    function renderMetaLine(line: string) {
      const [label, ...valueParts] = line.split(": ");
      const value = valueParts.join(": ");

      if (!value) {
        return React.createElement(Text, { key: line, style: styles.metaText }, line);
      }

      return React.createElement(
        Text,
        { key: line, style: styles.metaText },
        React.createElement(Text, { style: styles.metaLabel }, `${label}: `),
        value,
      );
    }
    function formatColumnLabel(label: string) {
      if (label === "Month / Row") {
        return "Month\nRow";
      }

      const words = label.replace(/\//g, " / ").split(/\s+/).filter(Boolean);

      if (words.length <= 1 || label.length <= 10) {
        return label;
      }

      const lines: string[] = [];
      let currentLine = "";

      for (const word of words) {
        const nextLine = currentLine ? `${currentLine} ${word}` : word;

        if (nextLine.length <= 11 || currentLine.length === 0) {
          currentLine = nextLine;
          continue;
        }

        lines.push(currentLine);
        currentLine = word;
      }

      if (currentLine) {
        lines.push(currentLine);
      }

      return lines.join("\n");
    }
    const renderCell = (
      text: string,
      width: number,
      options: {
        isHeader?: boolean;
        align: "left" | "right" | "center";
        isLastColumn?: boolean;
      },
    ) =>
      React.createElement(
        View,
        {
          style: [
            styles.cell,
            {
              width,
              textAlign: options.align,
              borderRightWidth: options?.isLastColumn ? 0 : 1,
            },
          ],
        },
        React.createElement(
          Text,
          { style: options?.isHeader ? styles.headerCellText : styles.bodyCellText },
          text,
        ),
      );
    const documentNode = React.createElement(
      Document,
      null,
      React.createElement(
        Page,
        {
          size: "A4",
          orientation: "landscape",
          style: styles.page,
        },
        React.createElement(
          View,
          { style: styles.headerBlock },
          React.createElement(
            Text,
            { style: styles.institutionName },
            institutionName,
          ),
          React.createElement(
            Text,
            { style: styles.institutionAddress },
            institutionAddress,
          ),
          React.createElement(
            Text,
            { style: styles.institutionTan },
            `TAN No.: ${institutionTan}`,
          ),
          React.createElement(Text, { style: styles.title }, tableModel.header.title),
          React.createElement(
            View,
            { style: styles.headerMetaRow },
            React.createElement(
              View,
              { style: styles.metaColumn },
              ...tableModel.header.rightLines
                .filter((line) => line.startsWith("Employee:"))
                .map(renderMetaLine),
            ),
            React.createElement(
              View,
              { style: styles.metaColumn },
              ...tableModel.header.rightLines
                .filter((line) => !line.startsWith("Employee:"))
                .map(renderMetaLine),
            ),
          ),
        ),
        React.createElement(
          View,
          {
            style: [styles.tableWrap, { width: tableModel.widthFit.tableWidth }],
          },
          React.createElement(
            View,
            { style: styles.tableHeaderRow },
            ...tableModel.columns.map((column, columnIndex) =>
              renderCell(formatColumnLabel(column.label), column.width, {
                isHeader: true,
                align: column.align,
                isLastColumn: columnIndex === tableModel.columns.length - 1,
              }),
            ),
          ),
          ...tableModel.rows.map((row) =>
            React.createElement(
              View,
              {
                key: row.key,
                style:
                  row.rowLabel === "Total"
                    ? [styles.tableRow, styles.totalRow]
                    : row.key === "selected-month" || Number(row.serialNumber) % 2 === 1
                      ? [styles.tableRow, styles.alternateRow]
                      : styles.tableRow,
              },
              ...tableModel.columns.map((column, columnIndex) => {
                const value =
                  column.key === "serialNumber"
                    ? row.serialNumber
                    : column.key === "rowLabel"
                      ? row.rowLabel
                      : formatPayrollPdfCurrency(row.values[column.key] ?? 0);

                return renderCell(String(value), column.width, {
                  align: column.align,
                  isLastColumn: columnIndex === tableModel.columns.length - 1,
                });
              }),
            ),
          ),
        ),
      ),
    );
    const blob = await pdf(documentNode).toBlob();
    const employeeSlug = slugify(formQuery.data.employee.name);
    const fileName =
      kind === "monthly"
        ? `payslip-${employeeSlug}-${slugify(selectedMonthDefinition.shortLabel)}.pdf`
        : `annual-payslip-${employeeSlug}-${getFinancialYearLabel(financialYearStart)}.pdf`;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="space-y-6 p-6">
      <PageHeader
        title="Payroll"
        description="Prepare monthly payroll and download employee payslips for the selected financial year."
      />

      <Card>
        <CardHeader>
          <CardTitle>Payroll period</CardTitle>
          <CardDescription>
            Select an employee and month, then reveal the payroll form.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {formKey ? (
            <div className="flex flex-wrap justify-end gap-3">
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
          <div className="grid gap-4 md:grid-cols-[1fr_220px_220px_auto]">
            <Field>
              <FieldLabel>Employee</FieldLabel>
              <Select
                value={selectedEmployeeId}
                onValueChange={(value) => setSelectedEmployeeId(value ?? "")}
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
                onValueChange={updateFinancialYear}
              >
                <SelectTrigger aria-label="Select payroll financial year">
                  <SelectValue />
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
                onValueChange={(value) => value && setSelectedMonth(value)}
              >
                <SelectTrigger aria-label="Select payroll month">
                  <SelectValue />
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
            <div className="flex items-end">
              <Button
                type="button"
                onClick={showPayrollForm}
                disabled={!selectedEmployeeId}
              >
                Show Payroll Form
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {formKey ? (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>
                {selectedEmployee
                  ? employeeLabelById[selectedEmployee.id]
                  : "Employee payroll"}
              </CardTitle>
              <CardDescription>
                Amounts are saved once for{" "}
                {getFinancialYearLabel(financialYearStart)} and reused for every
                month.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              <div className="border p-3">
                <p className="text-xs text-muted-foreground">Total earnings</p>
                <p className="text-lg font-semibold">
                  {formatCurrency(totals.earningsPaise)}
                </p>
              </div>
              <div className="border p-3">
                <p className="text-xs text-muted-foreground">
                  Total deductions
                </p>
                <p className="text-lg font-semibold">
                  {formatCurrency(totals.deductionsPaise)}
                </p>
              </div>
              <div className="border p-3">
                <p className="text-xs text-muted-foreground">Net pay</p>
                <p className="text-lg font-semibold">
                  {formatCurrency(totals.netPayPaise)}
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 xl:grid-cols-2">
            <PayrollTable
              section="earnings"
              lineItems={lineItems}
              onAmountChange={updateAmount}
            />
            <PayrollTable
              section="deductions"
              lineItems={lineItems}
              onAmountChange={updateAmount}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Custom payroll fields</CardTitle>
              <CardDescription>
                Labels are shared across the institution; amounts remain
                employee-specific.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <form
                className="grid gap-3 md:grid-cols-[180px_1fr_auto]"
                onSubmit={addCustomField}
              >
                <Field>
                  <FieldLabel>Section</FieldLabel>
                  <Select
                    value={customFieldSection}
                    onValueChange={(value) =>
                      setCustomFieldSection(
                        (value ?? "earnings") as PayrollSection,
                      )
                    }
                  >
                    <SelectTrigger aria-label="Select custom payroll field section">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="earnings">Earnings</SelectItem>
                        <SelectItem value="deductions">Deductions</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field data-invalid={Boolean(customFieldError) || undefined}>
                  <FieldLabel>Field label</FieldLabel>
                  <Input
                    value={customFieldLabel}
                    onChange={(event) => {
                      setCustomFieldLabel(event.target.value);
                      setCustomFieldError(null);
                    }}
                    aria-invalid={Boolean(customFieldError)}
                    placeholder="Allowance name"
                  />
                  <FieldError>{customFieldError}</FieldError>
                </Field>
                <div className="flex items-end">
                  <Button
                    type="submit"
                    disabled={addCustomFieldMutation.isPending}
                  >
                    <PlusIcon data-icon="inline-start" />
                    {addCustomFieldMutation.isPending
                      ? "Adding..."
                      : "Add Field"}
                  </Button>
                </div>
              </form>

              <div className="grid gap-3 md:grid-cols-2">
                {(["earnings", "deductions"] as const).map((section) => (
                  <div className="space-y-2 border p-3" key={section}>
                    <h3 className="text-sm font-medium">
                      {sectionLabels[section]}
                    </h3>
                    {(formQuery.data?.customFields ?? []).filter(
                      (field) => field.section === section,
                    ).length ? (
                      (formQuery.data?.customFields ?? [])
                        .filter((field) => field.section === section)
                        .map((field) => (
                          <div
                            className="flex items-center justify-between gap-3 text-sm"
                            key={field.id}
                          >
                            <span>{field.label}</span>
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="outline"
                              aria-label={`Archive ${field.label}`}
                              disabled={archiveCustomFieldMutation.isPending}
                              onClick={() => {
                                void archiveCustomField(field.id);
                              }}
                            >
                              <Trash2Icon />
                            </Button>
                          </div>
                        ))
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No custom fields.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button
              type="button"
              onClick={() => void savePayroll()}
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

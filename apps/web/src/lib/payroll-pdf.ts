export type PayrollPdfSection = "earnings" | "deductions";

export type PayrollPdfLineItem = {
  section: PayrollPdfSection;
  fixedFieldKey: string | null;
  customFieldDefinitionId: string | null;
  label: string;
  amountPaise: number;
  sortOrder: number;
};

export type PayrollPdfMonth = {
  value: string;
  label: string;
  shortLabel?: string;
};

export type PayrollPdfColumn = {
  key: string;
  label: string;
  width: number;
  kind: "leading" | "amount" | "total";
  align: "left" | "right" | "center";
  section?: PayrollPdfSection;
};

export type PayrollPdfRow = {
  key: string;
  serialNumber: string;
  rowLabel: string;
  values: Record<string, number>;
};

export type PayrollPdfTableModel = {
  header: {
    title: string;
    leftLines: string[];
    rightLines: string[];
  };
  columns: PayrollPdfColumn[];
  rows: PayrollPdfRow[];
  widthFit: {
    availableWidth: number;
    tableWidth: number;
    valueScale: number;
  };
};

export const PDF_PAGE_CONTENT_WIDTH = 760;
const LEADING_COLUMN_WIDTH = {
  serialNumber: 34,
  rowLabel: 96,
} as const;
const AMOUNT_COLUMN_WIDTH = 64;
const TOTAL_COLUMN_WIDTH = 72;
const MIN_COLUMN_WIDTH = {
  serialNumber: 20,
  rowLabel: 56,
  amount: 24,
  total: 28,
} as const;

function sortLineItems(lineItems: PayrollPdfLineItem[]) {
  return [...lineItems].sort((left, right) => {
    if (left.section !== right.section) {
      return left.section === "earnings" ? -1 : 1;
    }

    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder;
    }

    return left.label.localeCompare(right.label);
  });
}

function buildItemColumnKey(item: PayrollPdfLineItem) {
  if (item.fixedFieldKey) {
    return `${item.section}:fixed:${item.fixedFieldKey}`;
  }

  return `${item.section}:custom:${item.customFieldDefinitionId ?? item.label}`;
}

function buildRowValues(lineItems: PayrollPdfLineItem[], multiplier: number) {
  const values: Record<string, number> = {};
  let totalEarningsPaise = 0;
  let totalDeductionsPaise = 0;

  for (const item of lineItems) {
    const amountPaise = item.amountPaise * multiplier;
    values[buildItemColumnKey(item)] = amountPaise;

    if (item.section === "earnings") {
      totalEarningsPaise += amountPaise;
    } else {
      totalDeductionsPaise += amountPaise;
    }
  }

  values.totalEarnings = totalEarningsPaise;
  values.totalDeductions = totalDeductionsPaise;
  values.netSalary = totalEarningsPaise - totalDeductionsPaise;

  return values;
}

function getMinimumWidth(column: PayrollPdfColumn) {
  if (column.key === "serialNumber") {
    return MIN_COLUMN_WIDTH.serialNumber;
  }

  if (column.key === "rowLabel") {
    return MIN_COLUMN_WIDTH.rowLabel;
  }

  return column.kind === "total"
    ? MIN_COLUMN_WIDTH.total
    : MIN_COLUMN_WIDTH.amount;
}

function fitColumnsToPage(columns: PayrollPdfColumn[]) {
  const leadingColumns = columns.filter((column) => column.kind === "leading");
  const valueColumns = columns.filter((column) => column.kind !== "leading");
  const leadingBaseWidth = leadingColumns.reduce(
    (sum, column) => sum + column.width,
    0,
  );
  const leadingMinWidth = leadingColumns.reduce(
    (sum, column) => sum + getMinimumWidth(column),
    0,
  );
  const tableBaseWidth = columns.reduce((sum, column) => sum + column.width, 0);

  if (tableBaseWidth <= PDF_PAGE_CONTENT_WIDTH) {
    return {
      columns,
      widthFit: {
        availableWidth: PDF_PAGE_CONTENT_WIDTH,
        tableWidth: tableBaseWidth,
        valueScale: 1,
      },
    };
  }

  const overflow = tableBaseWidth - PDF_PAGE_CONTENT_WIDTH;
  const leadingReducibleWidth = Math.max(leadingBaseWidth - leadingMinWidth, 0);
  const leadingReduction = Math.min(overflow, leadingReducibleWidth);
  const adjustedLeadingWidth = leadingBaseWidth - leadingReduction;
  const remainingValueWidthBudget = PDF_PAGE_CONTENT_WIDTH - adjustedLeadingWidth;
  const valueBaseWidth = valueColumns.reduce((sum, column) => sum + column.width, 0);
  const valueScale =
    valueBaseWidth > 0
      ? Math.min(1, remainingValueWidthBudget / valueBaseWidth)
      : 1;

  const fittedLeadingColumns = leadingColumns.map((column) => {
    const ratio = leadingBaseWidth > 0 ? column.width / leadingBaseWidth : 0;
    const targetWidth = column.width - leadingReduction * ratio;

    return {
      ...column,
      width: Math.max(getMinimumWidth(column), targetWidth),
    };
  });

  const fittedValueColumns = valueColumns.map((column) => ({
    ...column,
    width: Math.max(getMinimumWidth(column), column.width * valueScale),
  }));

  const fittedColumns = columns.map((column) => {
    if (column.kind === "leading") {
      return fittedLeadingColumns.shift() as PayrollPdfColumn;
    }

    return fittedValueColumns.shift() as PayrollPdfColumn;
  });

  const fittedTableWidth = fittedColumns.reduce(
    (sum, column) => sum + column.width,
    0,
  );

  if (fittedTableWidth <= PDF_PAGE_CONTENT_WIDTH) {
    return {
      columns: fittedColumns,
      widthFit: {
        availableWidth: PDF_PAGE_CONTENT_WIDTH,
        tableWidth: fittedTableWidth,
        valueScale,
      },
    };
  }

  let remainingShrink = fittedTableWidth - PDF_PAGE_CONTENT_WIDTH;
  const normalizedValueColumns = fittedColumns.map((column) => ({ ...column }));

  while (remainingShrink > 0.01) {
    const shrinkableColumns = normalizedValueColumns.filter(
      (column) =>
        column.kind !== "leading" && column.width - getMinimumWidth(column) > 0.01,
    );

    if (shrinkableColumns.length === 0) {
      break;
    }

    const totalShrinkableWidth = shrinkableColumns.reduce(
      (sum, column) => sum + (column.width - getMinimumWidth(column)),
      0,
    );

    if (totalShrinkableWidth <= 0) {
      break;
    }

    for (const column of shrinkableColumns) {
      const availableShrink = column.width - getMinimumWidth(column);
      const columnShare = (availableShrink / totalShrinkableWidth) * remainingShrink;
      const appliedShrink = Math.min(availableShrink, columnShare);
      column.width -= appliedShrink;
      remainingShrink -= appliedShrink;
    }
  }

  const normalizedTableWidth = normalizedValueColumns.reduce(
    (sum, column) => sum + column.width,
    0,
  );
  const remainingOverflow = normalizedTableWidth - PDF_PAGE_CONTENT_WIDTH;

  if (remainingOverflow > 0.0001) {
    const lastShrinkableColumn = [...normalizedValueColumns]
      .reverse()
      .find(
        (column) => column.width - getMinimumWidth(column) >= remainingOverflow,
      );

    if (lastShrinkableColumn) {
      lastShrinkableColumn.width -= remainingOverflow;
    }
  }

  const finalTableWidth = normalizedValueColumns.reduce(
    (sum, column) => sum + column.width,
    0,
  );

  return {
    columns: normalizedValueColumns,
    widthFit: {
      availableWidth: PDF_PAGE_CONTENT_WIDTH,
      tableWidth: finalTableWidth,
      valueScale,
    },
  };
}

export function formatPayrollPdfCurrency(amountPaise: number) {
  if (amountPaise === 0) {
    return "";
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(amountPaise / 100);
}

export function buildPayrollPdfTableModel(input: {
  kind: "monthly" | "annual";
  financialYearLabel: string;
  selectedMonthLabel: string;
  months: PayrollPdfMonth[];
  lineItems: PayrollPdfLineItem[];
  institution: {
    name: string;
    address: string;
    tanNumber: string;
  };
  employee: {
    name: string;
  };
}) {
  const orderedLineItems = sortLineItems(input.lineItems);
  const earningsItems = orderedLineItems.filter(
    (item) => item.section === "earnings",
  );
  const deductionItems = orderedLineItems.filter(
    (item) => item.section === "deductions",
  );
  const valueColumns: PayrollPdfColumn[] = [
    ...earningsItems.map((item) => ({
      key: buildItemColumnKey(item),
      label: item.label,
      width: AMOUNT_COLUMN_WIDTH,
      kind: "amount" as const,
      align: "right" as const,
      section: item.section,
    })),
    {
      key: "totalEarnings",
      label: "Total Earnings",
      width: TOTAL_COLUMN_WIDTH,
      kind: "total" as const,
      align: "right" as const,
      section: "earnings" as const,
    },
    ...deductionItems.map((item) => ({
      key: buildItemColumnKey(item),
      label: item.label,
      width: AMOUNT_COLUMN_WIDTH,
      kind: "amount" as const,
      align: "right" as const,
      section: item.section,
    })),
    {
      key: "totalDeductions",
      label: "Total Deductions",
      width: TOTAL_COLUMN_WIDTH,
      kind: "total" as const,
      align: "right" as const,
      section: "deductions" as const,
    },
    {
      key: "netSalary",
      label: "Net Salary",
      width: TOTAL_COLUMN_WIDTH,
      kind: "total" as const,
      align: "right" as const,
    },
  ];
  const rows: PayrollPdfRow[] =
    input.kind === "monthly"
      ? [
          {
            key: "selected-month",
            serialNumber: "1",
            rowLabel: input.selectedMonthLabel,
            values: buildRowValues(orderedLineItems, 1),
          },
          {
            key: "total",
            serialNumber: "",
            rowLabel: "Total",
            values: buildRowValues(orderedLineItems, 1),
          },
        ]
      : [
          ...input.months.map((month, index) => ({
            key: month.value,
            serialNumber: String(index + 1),
            rowLabel: month.shortLabel ?? month.label,
            values: buildRowValues(orderedLineItems, 1),
          })),
          {
            key: "total",
            serialNumber: "",
            rowLabel: "Total",
            values: buildRowValues(orderedLineItems, input.months.length),
          },
        ];

  const baseColumns: PayrollPdfColumn[] = [
    {
      key: "serialNumber",
      label: "Sr.",
      width: LEADING_COLUMN_WIDTH.serialNumber,
      kind: "leading",
      align: "center",
    },
    {
      key: "rowLabel",
      label: "Month / Row",
      width: LEADING_COLUMN_WIDTH.rowLabel,
      kind: "leading",
      align: "left",
    },
    ...valueColumns,
  ];
  const fittedTable = fitColumnsToPage(baseColumns);

  return {
    header: {
      title: `PAY STATEMENT FOR THE FINANCIAL YEAR ${input.financialYearLabel}`,
      leftLines: [
        `School: ${input.institution.name}`,
        `Address: ${input.institution.address}`,
        `TAN No.: ${input.institution.tanNumber}`,
      ],
      rightLines:
        input.kind === "monthly"
          ? [
              `Employee: ${input.employee.name}`,
              `Payslip Month: ${input.selectedMonthLabel}`,
              `Statement Type: Monthly`,
            ]
          : [
              `Employee: ${input.employee.name}`,
              `Statement Type: Annual`,
              "Payroll Baseline: repeated for all 12 months",
            ],
    },
    columns: fittedTable.columns,
    rows,
    widthFit: fittedTable.widthFit,
  } satisfies PayrollPdfTableModel;
}

import { describe, expect, it } from "vitest";

import {
  PDF_PAGE_CONTENT_WIDTH,
  buildPayrollPdfTableModel,
  formatPayrollPdfCurrency,
  type PayrollPdfLineItem,
  type PayrollPdfMonth,
} from "./payroll-pdf";

const months: PayrollPdfMonth[] = [
  { value: "2026-04", label: "April 2026", shortLabel: "Apr 2026" },
  { value: "2026-05", label: "May 2026", shortLabel: "May 2026" },
  { value: "2026-06", label: "June 2026", shortLabel: "Jun 2026" },
  { value: "2026-07", label: "July 2026", shortLabel: "Jul 2026" },
  { value: "2026-08", label: "August 2026", shortLabel: "Aug 2026" },
  { value: "2026-09", label: "September 2026", shortLabel: "Sep 2026" },
  { value: "2026-10", label: "October 2026", shortLabel: "Oct 2026" },
  { value: "2026-11", label: "November 2026", shortLabel: "Nov 2026" },
  { value: "2026-12", label: "December 2026", shortLabel: "Dec 2026" },
  { value: "2027-01", label: "January 2027", shortLabel: "Jan 2027" },
  { value: "2027-02", label: "February 2027", shortLabel: "Feb 2027" },
  { value: "2027-03", label: "March 2027", shortLabel: "Mar 2027" },
];

function createLineItem(
  input: Partial<PayrollPdfLineItem> & Pick<PayrollPdfLineItem, "label">,
): PayrollPdfLineItem {
  return {
    section: "earnings",
    fixedFieldKey: null,
    customFieldDefinitionId: null,
    amountPaise: 0,
    sortOrder: 1,
    ...input,
  };
}

describe("buildPayrollPdfTableModel", () => {
  function buildModel(lineItems: PayrollPdfLineItem[], kind: "monthly" | "annual" = "monthly") {
    return buildPayrollPdfTableModel({
      kind,
      financialYearLabel: "2026-2027",
      selectedMonthLabel: "Jun 2026",
      months,
      institution: {
        name: "Paybuddy Public School",
        address: "123 Lake Road",
        tanNumber: "ABCD12345E",
      },
      employee: {
        name: "Asha Kumar",
      },
      lineItems,
    });
  }

  it("keeps fixed and custom columns in section and sort order", () => {
    const model = buildModel([
      createLineItem({
        section: "deductions",
        fixedFieldKey: "gpf",
        label: "G.P.F",
        sortOrder: 2,
      }),
      createLineItem({
        section: "earnings",
        fixedFieldKey: "basicPay",
        label: "Basic Pay",
        sortOrder: 1,
      }),
      createLineItem({
        section: "earnings",
        customFieldDefinitionId: "c1",
        label: "Special Allowance",
        sortOrder: 7,
      }),
      createLineItem({
        section: "deductions",
        customFieldDefinitionId: "c2",
        label: "Society",
        sortOrder: 8,
      }),
    ]);

    expect(model.columns.map((column) => column.label)).toEqual([
      "Sr.",
      "Month / Row",
      "Basic Pay",
      "Special Allowance",
      "Total Earnings",
      "G.P.F",
      "Society",
      "Total Deductions",
      "Net Salary",
    ]);
  });

  it("builds a monthly table with the selected month row and total row", () => {
    const model = buildModel([
      createLineItem({
        section: "earnings",
        fixedFieldKey: "basicPay",
        label: "Basic Pay",
        amountPaise: 100_000,
        sortOrder: 1,
      }),
      createLineItem({
        section: "deductions",
        fixedFieldKey: "recovery",
        label: "Recovery",
        amountPaise: 10_000,
        sortOrder: 1,
      }),
    ]);

    expect(model.rows).toHaveLength(2);
    expect(model.rows[0]).toMatchObject({
      serialNumber: "1",
      rowLabel: "Jun 2026",
    });
    expect(model.rows[1]).toMatchObject({
      serialNumber: "",
      rowLabel: "Total",
    });
  });

  it("builds an annual table with twelve repeated baseline months and a total row", () => {
    const model = buildModel(
      [
        createLineItem({
          section: "earnings",
          fixedFieldKey: "basicPay",
          label: "Basic Pay",
          amountPaise: 100_000,
          sortOrder: 1,
        }),
        createLineItem({
          section: "deductions",
          fixedFieldKey: "recovery",
          label: "Recovery",
          amountPaise: 10_000,
          sortOrder: 1,
        }),
      ],
      "annual",
    );

    expect(model.rows).toHaveLength(13);
    expect(model.rows[0]).toMatchObject({ serialNumber: "1", rowLabel: "Apr 2026" });
    expect(model.rows[11]).toMatchObject({ serialNumber: "12", rowLabel: "Mar 2027" });
    expect(model.rows[12]?.values.totalEarnings).toBe(1_200_000);
    expect(model.rows[12]?.values.totalDeductions).toBe(120_000);
    expect(model.rows[12]?.values.netSalary).toBe(1_080_000);
  });

  it("renders zero values as blank cells while keeping totals numeric", () => {
    const model = buildModel([
      createLineItem({
        section: "earnings",
        fixedFieldKey: "basicPay",
        label: "Basic Pay",
        amountPaise: 0,
        sortOrder: 1,
      }),
      createLineItem({
        section: "deductions",
        fixedFieldKey: "recovery",
        label: "Recovery",
        amountPaise: 0,
        sortOrder: 1,
      }),
    ]);

    expect(model.rows[0]?.values.totalEarnings).toBe(0);
    expect(model.rows[0]?.values.totalDeductions).toBe(0);
    expect(model.rows[0]?.values.netSalary).toBe(0);
    expect(formatPayrollPdfCurrency(0)).toBe("");
    expect(formatPayrollPdfCurrency(123_450)).toBe("₹1,234.50");
  });

  it("fits wide tables into a single scaled column set within the page width budget", () => {
    const lineItems = Array.from({ length: 18 }, (_, index) =>
      createLineItem({
        section: index < 9 ? "earnings" : "deductions",
        customFieldDefinitionId: `custom-${index + 1}`,
        label: `Field ${index + 1}`,
        amountPaise: 1_000,
        sortOrder: index + 1,
      }),
    );
    const model = buildModel(lineItems, "annual");
    const totalWidth = model.columns.reduce((sum, column) => sum + column.width, 0);

    expect(model.columns.map((column) => column.label)).toEqual([
      "Sr.",
      "Month / Row",
      ...Array.from({ length: 9 }, (_, index) => `Field ${index + 1}`),
      "Total Earnings",
      ...Array.from({ length: 9 }, (_, index) => `Field ${index + 10}`),
      "Total Deductions",
      "Net Salary",
    ]);
    expect(totalWidth).toBeLessThanOrEqual(PDF_PAGE_CONTENT_WIDTH);
    expect(model.widthFit.tableWidth).toBeLessThanOrEqual(
      model.widthFit.availableWidth,
    );
    expect(model.widthFit.valueScale).toBeLessThan(1);
  });

  it("builds report header metadata for monthly statements", () => {
    const model = buildModel([
      createLineItem({
        section: "earnings",
        fixedFieldKey: "basicPay",
        label: "Basic Pay",
      }),
    ]);

    expect(model.header.title).toBe(
      "PAY STATEMENT FOR THE FINANCIAL YEAR 2026-2027",
    );
    expect(model.header.leftLines).toEqual([
      "School: Paybuddy Public School",
      "Address: 123 Lake Road",
      "TAN No.: ABCD12345E",
    ]);
    expect(model.header.rightLines).toEqual([
      "Employee: Asha Kumar",
      "Payslip Month: Jun 2026",
      "Statement Type: Monthly",
    ]);
  });

  it("stores alignment metadata for leading and numeric columns", () => {
    const model = buildModel([
      createLineItem({
        section: "earnings",
        fixedFieldKey: "basicPay",
        label: "Basic Pay",
      }),
      createLineItem({
        section: "deductions",
        fixedFieldKey: "recovery",
        label: "Recovery",
      }),
    ]);

    expect(model.columns.find((column) => column.key === "serialNumber")?.align).toBe(
      "center",
    );
    expect(model.columns.find((column) => column.key === "rowLabel")?.align).toBe(
      "left",
    );
    expect(
      model.columns.find((column) => column.label === "Basic Pay")?.align,
    ).toBe("right");
    expect(
      model.columns.find((column) => column.key === "netSalary")?.align,
    ).toBe("right");
    expect(
      model.columns.find((column) => column.key === "serialNumber")?.width,
    ).toBeGreaterThan(0);
  });
});

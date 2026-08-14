import * as React from "react";

import type { PayrollPdfTableModel } from "./payroll-pdf";
import { formatPayrollPdfCurrency } from "./payroll-pdf";

export async function downloadPayrollDocument(input: {
  tableModel: PayrollPdfTableModel;
  fileName: string;
}) {
  const { Document, Page, Text, View, StyleSheet, pdf } = await import("@react-pdf/renderer");
  const styles = StyleSheet.create({
    page: { padding: 18, fontSize: 6, fontFamily: "Helvetica", color: "#111111" },
    header: {
      alignItems: "center",
      borderBottom: "1px solid #9ca3af",
      paddingBottom: 8,
      marginBottom: 10,
    },
    school: { fontSize: 12, fontWeight: 700, marginBottom: 2 },
    meta: { fontSize: 6.5, marginBottom: 2 },
    title: { fontSize: 9.5, fontWeight: 700, marginTop: 4, marginBottom: 6 },
    table: { alignSelf: "center", borderTop: "1px solid #94a3b8", borderLeft: "1px solid #94a3b8" },
    row: { flexDirection: "row" },
    headerRow: { flexDirection: "row", backgroundColor: "#dbe4f0" },
    alternate: { backgroundColor: "#f8fafc" },
    projected: { backgroundColor: "#f3f4f6", color: "#9ca3af" },
    total: { backgroundColor: "#e2e8f0" },
    cell: {
      padding: 3,
      borderRight: "1px solid #94a3b8",
      borderBottom: "1px solid #94a3b8",
      justifyContent: "center",
    },
    headerText: { fontSize: 5.5, fontWeight: 700, textAlign: "center" },
    bodyText: { fontSize: 5.7 },
  });
  const model = input.tableModel;
  const renderCell = (text: string, columnIndex: number, header = false) => {
    const column = model.columns[columnIndex];
    return React.createElement(
      View,
      {
        key: column.key,
        style: [
          styles.cell,
          {
            width: column.width,
            textAlign: column.align,
            borderRightWidth: columnIndex === model.columns.length - 1 ? 0 : 1,
          },
        ],
      },
      React.createElement(Text, { style: header ? styles.headerText : styles.bodyText }, text),
    );
  };
  const documentNode = React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: "A4", orientation: "landscape", style: styles.page },
      React.createElement(
        View,
        { style: styles.header },
        ...model.header.leftLines.map((line, index) =>
          React.createElement(
            Text,
            { key: line, style: index === 0 ? styles.school : styles.meta },
            line,
          ),
        ),
        React.createElement(Text, { style: styles.title }, model.header.title),
        ...model.header.rightLines.map((line) =>
          React.createElement(Text, { key: line, style: styles.meta }, line),
        ),
      ),
      React.createElement(
        View,
        { style: [styles.table, { width: model.widthFit.tableWidth }] },
        React.createElement(
          View,
          { style: styles.headerRow },
          ...model.columns.map((column, index) => renderCell(column.label, index, true)),
        ),
        ...model.rows.map((row) =>
          React.createElement(
            View,
            {
              key: row.key,
              style: [
                styles.row,
                row.rowLabel === "Total"
                  ? styles.total
                  : Number(row.serialNumber) % 2 === 1
                    ? styles.alternate
                    : {},
                row.isProjected ? styles.projected : {},
              ],
            },
            ...model.columns.map((column, index) => {
              const value =
                column.key === "serialNumber"
                  ? row.serialNumber
                  : column.key === "rowLabel"
                    ? row.rowLabel
                    : formatPayrollPdfCurrency(row.values[column.key] ?? 0);
              return renderCell(String(value), index);
            }),
          ),
        ),
      ),
    ),
  );
  const blob = await pdf(documentNode).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = input.fileName;
  link.click();
  URL.revokeObjectURL(url);
}

import { describe, expect, it } from "vitest";

import { buildEmployeeDirectoryCsv, projectEmployeeDirectory } from "./employee-directory";

const columns = [
  {
    key: "employee",
    label: "Employee",
    defaultVisible: true,
    kind: "fixed" as const,
    fieldDefinitionId: null,
    formatKind: "text" as const,
  },
  {
    key: "rank",
    label: "Rank",
    defaultVisible: true,
    kind: "fixed" as const,
    fieldDefinitionId: null,
    formatKind: "integer" as const,
  },
  {
    key: "created",
    label: "Created",
    defaultVisible: false,
    kind: "fixed" as const,
    fieldDefinitionId: null,
    formatKind: "date-time" as const,
  },
];

describe("employee directory projection", () => {
  it("searches visible formatted columns and clamps pagination", () => {
    const projection = projectEmployeeDirectory({
      columns,
      rows: [
        {
          id: "1",
          values: { employee: "Patel, Asha", rank: 12, created: "2026-04-01T00:00:00.000Z" },
        },
      ],
      visibleColumns: { employee: true, rank: false, created: false },
      searchTerm: "asha",
      pageIndex: 99,
      pageSize: 10,
    });
    expect(projection.pageIndex).toBe(0);
    expect(projection.pageRows[0]?.values.employee).toBe("Patel, Asha");
  });

  it("exports the full supplied row set and escapes CSV values", () => {
    const csv = buildEmployeeDirectoryCsv({
      columns: columns.slice(0, 2),
      rows: [{ id: "1", values: { employee: 'Patel, "Asha"', rank: 1000 } }],
    });
    expect(csv).toContain('"Patel, ""Asha"""');
    expect(csv).toContain("1,000");
  });

  it("keeps metadata and values aligned while formatting dates and custom fields", () => {
    const extendedColumns = [
      ...columns,
      {
        key: "dateOfBirth",
        label: "Date of Birth",
        defaultVisible: true,
        kind: "fixed" as const,
        fieldDefinitionId: null,
        formatKind: "date" as const,
      },
      {
        key: "customField:badge",
        label: "Badge",
        defaultVisible: true,
        kind: "custom" as const,
        fieldDefinitionId: "badge",
        formatKind: "text" as const,
      },
    ];
    const projection = projectEmployeeDirectory({
      columns: extendedColumns,
      rows: [
        {
          id: "1",
          values: {
            employee: "Patel, Asha",
            rank: 1,
            created: "2026-04-01T10:30:00.000Z",
            dateOfBirth: "1990-01-02",
            "customField:badge": "BN-1",
          },
        },
      ],
      visibleColumns: Object.fromEntries(extendedColumns.map((column) => [column.key, true])),
      searchTerm: "",
      pageIndex: 0,
      pageSize: 10,
    });

    expect(Object.keys(projection.pageRows[0]?.values ?? {})).toEqual(
      extendedColumns.map((column) => column.key),
    );
    expect(projection.pageRows[0]?.values.dateOfBirth).toContain("1990");
    expect(projection.pageRows[0]?.values.created).toContain("2026");
    expect(projection.pageRows[0]?.values["customField:badge"]).toBe("BN-1");
  });

  it("paginates the filtered directory rather than truncating the export source", () => {
    const rows = Array.from({ length: 21 }, (_, index) => ({
      id: String(index),
      values: { employee: `Employee ${index}`, rank: index, created: null },
    }));
    const projection = projectEmployeeDirectory({
      columns,
      rows,
      visibleColumns: { employee: true, rank: true, created: false },
      searchTerm: "Employee",
      pageIndex: 2,
      pageSize: 10,
    });
    expect(projection.pageRows).toHaveLength(1);
    expect(projection.filteredRows).toHaveLength(21);
  });
});

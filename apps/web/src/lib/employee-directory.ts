export type DirectoryColumn = {
  key: string;
  label: string;
  defaultVisible: boolean;
  kind: "fixed" | "custom";
  fieldDefinitionId: string | null;
  formatKind: "text" | "integer" | "date" | "date-time";
};

export type DirectoryRow = {
  id: string;
  values: Record<string, string | number | null>;
};

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeZone: "UTC",
});
const dateTimeFormatter = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
});
const integerFormatter = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

export function getInitialDirectoryColumnVisibility(columns: DirectoryColumn[]) {
  return Object.fromEntries(columns.map((column) => [column.key, column.defaultVisible]));
}

export function formatDirectoryValue(
  column: DirectoryColumn,
  value: string | number | null | undefined,
) {
  if (value === null || value === undefined || value === "") return "";
  if (column.formatKind === "integer") return integerFormatter.format(Number(value));
  if (column.formatKind === "date-time") return dateTimeFormatter.format(new Date(value));
  if (column.formatKind === "date") {
    const [yearText, monthText, dayText] = String(value).split("-");
    return dateFormatter.format(
      new Date(Date.UTC(Number(yearText), Number(monthText) - 1, Number(dayText))),
    );
  }
  return String(value);
}

function normalizeSearchText(value: string) {
  return value.trim().toLocaleLowerCase();
}

export function projectEmployeeDirectory<TRow extends DirectoryRow>(input: {
  columns: DirectoryColumn[];
  rows: TRow[];
  visibleColumns: Record<string, boolean>;
  searchTerm: string;
  pageIndex: number;
  pageSize: number;
}) {
  const columns = input.columns.filter((column) => input.visibleColumns[column.key]);
  const normalizedSearchTerm = normalizeSearchText(input.searchTerm);
  const formattedRows = input.rows.map((row) => ({
    row,
    values: Object.fromEntries(
      columns.map((column) => [column.key, formatDirectoryValue(column, row.values[column.key])]),
    ),
  }));
  const filteredRows = normalizedSearchTerm
    ? formattedRows.filter((entry) =>
        columns.some((column) =>
          normalizeSearchText(entry.values[column.key] ?? "").includes(normalizedSearchTerm),
        ),
      )
    : formattedRows;
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / input.pageSize));
  const pageIndex = Math.min(Math.max(input.pageIndex, 0), totalPages - 1);
  const pageStart = pageIndex * input.pageSize;

  return {
    columns,
    filteredRows,
    pageRows: filteredRows.slice(pageStart, pageStart + input.pageSize),
    pageIndex,
    totalPages,
    pageStart,
  };
}

function escapeCsvValue(value: string) {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function buildEmployeeDirectoryCsv(input: {
  columns: DirectoryColumn[];
  rows: DirectoryRow[];
}) {
  return [
    input.columns.map((column) => escapeCsvValue(column.label)).join(","),
    ...input.rows.map((row) =>
      input.columns
        .map((column) => escapeCsvValue(formatDirectoryValue(column, row.values[column.key])))
        .join(","),
    ),
  ].join("\r\n");
}

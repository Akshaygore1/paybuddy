const indianMoneyFormatter = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function removeMoneyGrouping(value: string) {
  return value.replaceAll(",", "");
}

export function parsePayrollInputToPaise(value: string) {
  const normalized = removeMoneyGrouping(value).trim();

  if (!normalized) {
    return 0;
  }

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return Number.NaN;
  }

  const [rupeesText, paiseText = ""] = normalized.split(".");
  return Number(rupeesText) * 100 + Number(paiseText.padEnd(2, "0"));
}

export function formatPaiseForInput(amountPaise: number) {
  if (amountPaise === 0) {
    return "";
  }

  return indianMoneyFormatter.format(amountPaise / 100);
}

export function formatPaiseForDisplay(amountPaise: number) {
  return indianMoneyFormatter.format(amountPaise / 100);
}

export function formatPayrollInput(value: string) {
  if (!value.trim()) {
    return "";
  }

  const amountPaise = parsePayrollInputToPaise(value);
  return Number.isFinite(amountPaise) ? formatPaiseForDisplay(amountPaise) : value;
}

export function normalizePayrollInputForApi(value: string) {
  return removeMoneyGrouping(value).trim();
}

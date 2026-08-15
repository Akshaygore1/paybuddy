const indianCurrencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
});

const institutionDateTimeFormatter = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatIndianCurrencyFromPaise(amountPaise: number) {
  return indianCurrencyFormatter.format(amountPaise / 100);
}

export function formatInstitutionDateTime(value: Date | string | number) {
  return institutionDateTimeFormatter.format(new Date(value));
}

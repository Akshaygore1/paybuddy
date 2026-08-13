export const D1_MAX_BOUND_PARAMETERS = 100;
export const PAYROLL_LINE_ITEM_BOUND_PARAMETERS = 8;
export const EMPLOYEE_CUSTOM_FIELD_VALUE_BOUND_PARAMETERS = 4;

export function chunkForD1<T>(values: readonly T[], boundParametersPerValue: number): T[][] {
  if (!Number.isInteger(boundParametersPerValue) || boundParametersPerValue < 1) {
    throw new RangeError("D1 bound parameters per value must be a positive integer");
  }

  const valuesPerStatement = Math.floor(D1_MAX_BOUND_PARAMETERS / boundParametersPerValue);

  if (valuesPerStatement < 1) {
    throw new RangeError("A single value exceeds D1's bound-parameter limit");
  }

  const chunks: T[][] = [];

  for (let index = 0; index < values.length; index += valuesPerStatement) {
    chunks.push(values.slice(index, index + valuesPerStatement));
  }

  return chunks;
}

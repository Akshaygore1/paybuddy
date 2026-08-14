import { describe, expect, it, vi } from "vitest";

import { executeD1Batch, planD1Statements, queryD1InBatches } from "./d1";

type ParameterizedValue = { id: number; parameterCount: number };

function buildSyntheticD1Statement(
  values: readonly [ParameterizedValue, ...ParameterizedValue[]],
) {
  return {
    values: [...values],
    toSQL: () => ({
      params: values.flatMap((value) => Array.from({ length: value.parameterCount })),
    }),
  };
}

describe("D1 statement planning", () => {
  it("returns no statements for empty values", () => {
    expect(planD1Statements([], buildSyntheticD1Statement)).toEqual([]);
  });

  it("keeps a statement at exactly 100 parameters", () => {
    const statements = planD1Statements(
      [
        { id: 1, parameterCount: 40 },
        { id: 2, parameterCount: 60 },
      ],
      buildSyntheticD1Statement,
    );

    expect(statements).toHaveLength(1);
    expect(statements[0]?.toSQL().params).toHaveLength(100);
  });

  it("splits a statement that would have 101 parameters and preserves value order", () => {
    const statements = planD1Statements(
      [
        { id: 1, parameterCount: 40 },
        { id: 2, parameterCount: 60 },
        { id: 3, parameterCount: 1 },
        { id: 4, parameterCount: 99 },
      ],
      buildSyntheticD1Statement,
    );

    expect(statements.map((statement) => statement.values.map((value) => value.id))).toEqual([
      [1, 2],
      [3, 4],
    ]);
    expect(statements.map((statement) => statement.toSQL().params.length)).toEqual([100, 100]);
  });

  it("rejects a single value that exceeds the D1 limit", () => {
    expect(() =>
      planD1Statements([{ id: 1, parameterCount: 101 }], buildSyntheticD1Statement),
    ).toThrowError("A single value exceeds D1's bound-parameter limit");
  });
});

describe("D1 high-cardinality queries", () => {
  it("flattens chunk results in input and query-result order", async () => {
    const values = Array.from({ length: 101 }, (_, index) => index + 1);

    const results = await queryD1InBatches(values, (chunk) =>
      Object.assign(Promise.resolve(chunk.map((value) => `row-${value}`)), {
        toSQL: () => ({ params: [...chunk] }),
      }),
    );

    expect(results).toEqual(values.map((value) => `row-${value}`));
  });
});

describe("D1 atomic batches", () => {
  it("skips an empty batch", async () => {
    const batch = vi.fn();

    await executeD1Batch({ batch }, []);

    expect(batch).not.toHaveBeenCalled();
  });

  it("executes required leading statements and planned work in one ordered batch", async () => {
    const batch = vi.fn(async (statements: readonly string[]) => statements);

    const result = await executeD1Batch({ batch }, ["work-1", "work-2"], ["required-1"]);

    expect(batch).toHaveBeenCalledOnce();
    expect(batch).toHaveBeenCalledWith(["required-1", "work-1", "work-2"]);
    expect(result).toEqual(["required-1", "work-1", "work-2"]);
  });

  it("propagates an atomic batch failure", async () => {
    const failure = new Error("batch failed");
    const batch = vi.fn(async () => Promise.reject(failure));

    await expect(executeD1Batch({ batch }, ["work"])).rejects.toBe(failure);
    expect(batch).toHaveBeenCalledOnce();
  });
});

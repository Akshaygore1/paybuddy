const D1_MAX_BOUND_PARAMETERS = 100;

type D1Statement = {
  toSQL(): { params: readonly unknown[] };
};

type NonEmptyValues<T> = readonly [T, ...T[]];

function throwD1BoundParameterLimitError(): never {
  throw new RangeError("A single value exceeds D1's bound-parameter limit");
}

export function planD1Statements<TValue, TStatement extends D1Statement>(
  values: readonly TValue[],
  buildStatement: (values: NonEmptyValues<TValue>) => TStatement,
): TStatement[] {
  const statements: TStatement[] = [];
  let currentValues: TValue[] = [];
  let currentStatement: TStatement | undefined;

  for (const value of values) {
    const candidateValues = [...currentValues, value] as unknown as [TValue, ...TValue[]];
    const candidateStatement = buildStatement(candidateValues);

    if (candidateStatement.toSQL().params.length <= D1_MAX_BOUND_PARAMETERS) {
      currentValues = candidateValues;
      currentStatement = candidateStatement;
      continue;
    }

    if (!currentStatement) {
      throwD1BoundParameterLimitError();
    }

    statements.push(currentStatement);
    currentValues = [value];
    currentStatement = buildStatement(currentValues as [TValue, ...TValue[]]);

    if (currentStatement.toSQL().params.length > D1_MAX_BOUND_PARAMETERS) {
      throwD1BoundParameterLimitError();
    }
  }

  if (currentStatement) {
    statements.push(currentStatement);
  }

  return statements;
}

export async function queryD1InBatches<
  TValue,
  TResult,
  TStatement extends D1Statement & PromiseLike<readonly TResult[]>,
>(
  values: readonly TValue[],
  buildStatement: (values: NonEmptyValues<TValue>) => TStatement,
): Promise<TResult[]> {
  const resultSets = await Promise.all(planD1Statements(values, buildStatement));
  return resultSets.flat();
}

export async function executeD1Batch<TStatement, TResult>(
  db: { batch(statements: [TStatement, ...TStatement[]]): Promise<TResult> },
  statements: readonly TStatement[],
  requiredLeadingStatements: readonly TStatement[] = [],
): Promise<TResult | undefined> {
  const orderedStatements = [...requiredLeadingStatements, ...statements];
  const [firstStatement, ...remainingStatements] = orderedStatements;

  if (firstStatement === undefined) {
    return undefined;
  }

  return db.batch([firstStatement, ...remainingStatements]);
}

import { createClient, type InArgs, type InStatement } from "@libsql/client";

export type RecordedD1Statement = {
  sql: string;
  params: unknown[];
};

type QueryHandler = (statement: RecordedD1Statement) => unknown[][];

export function createRecordingD1(input: {
  query: QueryHandler;
  batch?: (statements: RecordedD1Statement[]) => void;
}) {
  const queries: RecordedD1Statement[] = [];
  const batches: RecordedD1Statement[][] = [];

  function createStatement(sql: string, params: unknown[] = []) {
    const statement = { sql, params: Array.from(params) };

    return {
      sql,
      params: statement.params,
      bind: (...boundParams: unknown[]) => createStatement(sql, boundParams),
      raw: async () => {
        queries.push(statement);
        return input.query(statement);
      },
      all: async () => {
        queries.push(statement);
        return { results: [] };
      },
      run: async () => {
        queries.push(statement);
        return { success: true, results: [] };
      },
      first: async () => null,
    };
  }

  const client = {
    prepare: (sql: string) => createStatement(sql),
    batch: async (preparedStatements: Array<{ sql: string; params: unknown[] }>) => {
      const statements = preparedStatements.map(({ sql, params }) => ({
        sql,
        params: Array.from(params),
      }));
      batches.push(statements);
      input.batch?.(statements);

      return statements.map(() => ({ success: true, results: [] }));
    },
  } as unknown as D1Database;

  return { client, queries, batches };
}

export async function createSqliteD1(options: { failBatchAt?: number } = {}) {
  const sqlite = createClient({ url: ":memory:" });

  function toD1Result(result: Awaited<ReturnType<typeof sqlite.execute>>) {
    return {
      success: true,
      results: result.rows.map((row) => Object.fromEntries(Object.entries(row))),
      meta: {
        changes: result.rowsAffected,
        last_row_id: result.lastInsertRowid,
      },
    };
  }

  function prepare(sql: string, params: unknown[] = []) {
    const statement = { sql, args: params as InArgs };

    return {
      sql,
      args: statement.args,
      bind: (...boundParams: unknown[]) => prepare(sql, boundParams),
      raw: async () => {
        const result = await sqlite.execute(statement);
        return result.rows.map((row) => Object.values(row));
      },
      all: async () => toD1Result(await sqlite.execute(statement)),
      run: async () => toD1Result(await sqlite.execute(statement)),
      first: async (column?: string) => {
        const result = await sqlite.execute(statement);
        const row = result.rows[0];

        if (!row) {
          return null;
        }

        return column ? row[column] : Object.fromEntries(Object.entries(row));
      },
    };
  }

  const client = {
    prepare: (sql: string) => prepare(sql),
    batch: async (statements: Array<{ sql: string; args: InArgs }>) => {
      const batchStatements: InStatement[] = statements.map((statement, index) =>
        index === options.failBatchAt
          ? { sql: "insert into __forced_batch_failure values (1)" }
          : statement,
      );
      const results = await sqlite.batch(batchStatements, "write");

      return results.map(toD1Result);
    },
  } as unknown as D1Database;

  return {
    client,
    execute: sqlite.execute.bind(sqlite),
    executeMultiple: sqlite.executeMultiple.bind(sqlite),
    batch: sqlite.batch.bind(sqlite),
    close: () => sqlite.close(),
  };
}

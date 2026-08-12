# Migrating local D1 / SQLite data to Cloudflare D1

Research date: 2026-08-11

## Short answer

Cloudflare supports moving a Wrangler-managed local D1 database to a remote D1 database by exporting the local database as D1-compatible SQL, then executing that file against the remote database:

```bash
npx wrangler d1 export <DB_NAME> --local --output=./local-d1.sql
npx wrangler d1 execute <DB_NAME> --remote --file=./local-d1.sql
```

Use `--remote` explicitly for the import. Since Wrangler 3.33.0, D1 execution defaults to local unless `--remote` is supplied. The command forms and flags are documented in Cloudflare's [Wrangler D1 command reference](https://developers.cloudflare.com/d1/wrangler-commands/), and Cloudflare documents export followed by `d1 execute --file` as the supported import/export workflow in [Import and export data](https://developers.cloudflare.com/d1/best-practices/import-export-data/).

## Recommended migration runbook

### 1. Identify the source and target

In a normal Wrangler project, the logical database name is the `database_name` in the `d1_databases` array of `wrangler.jsonc`/`wrangler.toml`; the binding is the name used by application code. See Cloudflare's [`d1_databases` configuration reference](https://developers.cloudflare.com/workers/wrangler/configuration/#d1-databases).

List the remote databases in the authenticated Cloudflare account and inspect the intended target:

```bash
npx wrangler d1 list
npx wrangler d1 info <DB_NAME>
```

`d1 list` returns the account's remote D1 databases, while `d1 info` reports the selected remote database's state and size ([Wrangler D1 commands](https://developers.cloudflare.com/d1/wrangler-commands/)).

Confirm that the intended local database has the expected tables before exporting it:

```bash
npx wrangler d1 execute <DB_NAME> --local \
  --command="SELECT name FROM sqlite_schema WHERE type='table' ORDER BY name;"
```

Cloudflare uses the same query to validate an import in its [import guide](https://developers.cloudflare.com/d1/best-practices/import-export-data/).

### 2. Back up the remote target before changing it

If the target already exists or contains anything valuable, create a portable SQL backup:

```bash
npx wrangler d1 export <DB_NAME> --remote \
  --output=./remote-before-local-import.sql
```

Also capture the current Time Travel bookmark immediately before import:

```bash
npx wrangler d1 time-travel info <DB_NAME>
```

D1 Time Travel is automatically enabled on production-backend databases. Retention is 30 days on Workers Paid and 7 days on Workers Free. A restore overwrites the database in place and cancels in-flight queries, so retain the bookmark and the SQL export. See [Time Travel and backups](https://developers.cloudflare.com/d1/reference/time-travel/) and [D1 limits](https://developers.cloudflare.com/d1/platform/limits/).

Prefer importing into a new, empty remote database. Importing a full schema-and-data dump into a non-empty target can conflict with existing tables, primary keys, or unique values.

### 3. Export the local database

For local data produced by `wrangler dev`, use Wrangler's exporter rather than dumping the backing SQLite file manually:

```bash
npx wrangler d1 export <DB_NAME> --local --output=./local-d1.sql
```

The exporter can also limit output to a table, schema only, or data only:

```bash
npx wrangler d1 export <DB_NAME> --local --table=<TABLE> --output=./table.sql
npx wrangler d1 export <DB_NAME> --local --no-data --output=./schema.sql
npx wrangler d1 export <DB_NAME> --local --no-schema --output=./data.sql
```

These flags are defined in the [`d1 export` reference](https://developers.cloudflare.com/d1/wrangler-commands/#d1-export).

### 4. Import into remote D1

After authenticating Wrangler and ensuring the target is correct:

```bash
npx wrangler d1 execute <DB_NAME> --remote --file=./local-d1.sql
```

Cloudflare's getting-started guide states that if remote file execution fails, D1 returns the database to its original state and the file can be retried ([Deploy your application](https://developers.cloudflare.com/d1/get-started/#5-deploy-your-application)). This is still not a live replication mechanism: stop or quiesce application writes during the final export/import window if the source can change, otherwise post-export writes will not be copied.

### 5. Verify the result

Compare local and remote table lists:

```bash
npx wrangler d1 execute <DB_NAME> --local \
  --command="SELECT name FROM sqlite_schema WHERE type='table' ORDER BY name;"

npx wrangler d1 execute <DB_NAME> --remote \
  --command="SELECT name FROM sqlite_schema WHERE type='table' ORDER BY name;"
```

Compare row counts for every application table, for example:

```bash
npx wrangler d1 execute <DB_NAME> --local \
  --command='SELECT COUNT(*) AS count FROM employees;'

npx wrangler d1 execute <DB_NAME> --remote \
  --command='SELECT COUNT(*) AS count FROM employees;'
```

Finally, check database and foreign-key consistency:

```bash
npx wrangler d1 execute <DB_NAME> --remote \
  --command='PRAGMA quick_check; PRAGMA foreign_key_check;'
```

Cloudflare documents `PRAGMA quick_check` as returning `ok` for a consistent database and `PRAGMA foreign_key_check` as reporting invalid foreign-key references in [Supported SQL statements](https://developers.cloudflare.com/d1/sql-api/sql-statements/#pragma-quick_check).

## If the source is a raw SQLite file

D1 cannot ingest a `.sqlite`/`.sqlite3` file directly. Cloudflare's supported conversion is:

```bash
sqlite3 db_dump.sqlite3 .dump > db.sql
```

Before importing `db.sql`, Cloudflare says to:

1. Remove the outer `BEGIN TRANSACTION` and `COMMIT;` statements.
2. Remove the `_cf_KV` table creation statement if present.

Then import the SQL file:

```bash
npx wrangler d1 execute <DB_NAME> --remote --file=./db.sql
```

The reason for removing the explicit transaction is that D1 performs the file import inside its own transaction; leaving the dump transaction in place produces `cannot start a transaction within a transaction`. See [Convert SQLite database files](https://developers.cloudflare.com/d1/best-practices/import-export-data/#convert-sqlite-database-files) and the guide's [troubleshooting section](https://developers.cloudflare.com/d1/best-practices/import-export-data/#troubleshooting).

For a Miniflare backing file, prefer `wrangler d1 export --local` whenever possible. A raw `.dump` includes emulator-internal tables and PRAGMAs that a normal D1 export is designed to avoid.

## Transactions and foreign keys

D1 enforces foreign keys by default, equivalent to `PRAGMA foreign_keys = on`. Each query runs in an implicit transaction, so an import cannot turn normal enforcement off. If table creation or loading order temporarily violates constraints, put `PRAGMA defer_foreign_keys = on` before those statements; every violation must be resolved by transaction end or the import fails. Deferral also does not suppress `ON DELETE CASCADE`. See [Define foreign keys](https://developers.cloudflare.com/d1/sql-api/foreign-keys/).

Cloudflare's import troubleshooting also recommends ordering related tables so that referenced tables exist before statements that refer to them. A dump produced by `wrangler d1 export --local` is preferable because Wrangler controls the generated ordering and format.

## Limits and operational caveats

Current Cloudflare limits relevant to migration are:

- Maximum `d1 execute` import file: 5 GB. Split larger imports into multiple files.
- Maximum database size: 10 GB on Workers Paid; 500 MB on Workers Free.
- Maximum SQL statement length: 100,000 bytes. Split oversized multi-row `INSERT` statements.
- Maximum string, BLOB, or row size: 2 MB.
- Maximum SQL query duration: 30 seconds; large post-import transformations need batching.

These values are from [D1 platform limits](https://developers.cloudflare.com/d1/platform/limits/).

Additional export limitations from Cloudflare's [import/export guide](https://developers.cloudflare.com/d1/best-practices/import-export-data/#known-limitations):

- Export is unsupported for virtual tables, including databases containing FTS5 virtual tables; the documented workaround is to remove and recreate them.
- A running remote export blocks other requests to that database.
- Numeric values can be affected by JavaScript's 52-bit number precision.

Remote imports also make the database unavailable for their duration according to Cloudflare's [D1 import API](https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/import/). Plan a maintenance window for a database that already serves traffic.

## This repository's actual state

This project is provisioned by Alchemy rather than a checked-in Wrangler D1 configuration:

- [`packages/infra/alchemy.run.ts`](../../packages/infra/alchemy.run.ts) declares `D1Database("database", ...)`.
- The failed deployment's intended remote name is `tds-nivaran-database-akshay`, as shown by the deployment error. The current `packages/infra/.alchemy/tds-nivaran/akshay/database.json` resource is still in `creating` state and has no remote UUID, so authentication/deployment must succeed before an import can target it.
- Wrangler normally persists local bindings under `.wrangler/state`, commonly showing D1 under `.wrangler/state/v3/d1`; Cloudflare documents this default in [Local data](https://developers.cloudflare.com/workers/local-development/local-data/#where-local-data-gets-stored).
- Alchemy 0.91.2 overrides that default. Local source inspection of `alchemy/src/cloudflare/miniflare/paths.ts` shows its default persistence root is `<workspace>/.alchemy/miniflare/v3`, and its Vite plugin passes that path to Cloudflare's persistence configuration. In this checkout the corresponding D1 directory is `.alchemy/miniflare/v3/d1`, not `.wrangler/state/v3/d1`.
- `.alchemy/miniflare/v3/d1` currently contains no D1 backing file.
- A raw backup does exist at `.alchemy/backups/tds-nivaran-before-paybuddy-migration-20260811.sqlite`. It contains the application schema and eight `d1_migrations` rows, but every inspected application table currently has **zero rows** (`account`, `session`, `user`, `verification`, `todo`, `institutions`, `employees`, employee/payroll profile and custom-field tables, and payroll line items). Importing this particular backup would therefore migrate schema/migration history, but no user or business records.
- That raw backup's `.dump` contains Miniflare's `_cf_METADATA` table, `PRAGMA foreign_keys=OFF`, and an outer transaction. It should not be uploaded verbatim. If it becomes the selected source, create and review a cleaned SQL dump following Cloudflare's raw-SQLite guidance, omitting emulator metadata, and validate it against an empty remote database first.

Because the only currently located backup has zero application rows, first confirm whether the desired local data is in another Alchemy workspace/state directory, another Git worktree, or a different local SQLite backup before performing a production import.

## Primary sources

- [Cloudflare D1: Wrangler commands](https://developers.cloudflare.com/d1/wrangler-commands/)
- [Cloudflare D1: Import and export data](https://developers.cloudflare.com/d1/best-practices/import-export-data/)
- [Cloudflare Workers: Local data](https://developers.cloudflare.com/workers/local-development/local-data/)
- [Cloudflare D1: Define foreign keys](https://developers.cloudflare.com/d1/sql-api/foreign-keys/)
- [Cloudflare D1: Supported SQL statements](https://developers.cloudflare.com/d1/sql-api/sql-statements/)
- [Cloudflare D1: Platform limits](https://developers.cloudflare.com/d1/platform/limits/)
- [Cloudflare D1: Time Travel and backups](https://developers.cloudflare.com/d1/reference/time-travel/)

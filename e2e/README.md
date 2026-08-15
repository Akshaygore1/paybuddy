# End-to-end test suite

This directory contains the Playwright end-to-end (E2E) tests for TDS Nivaran. The tests exercise the application through the browser and use authenticated API calls only to prepare and reset disposable test data.

The suite is designed for a disposable local or staging deployment. Never point it at a customer account or a database containing valuable data.

## The test-data model

Most tests share one dedicated institution configured in `e2e/.env.test`. That institution is deliberately kept in place, but its child data is reset around every test. This means a test does not depend on another test having run first.

The lifecycle for a normal test is:

1. The fixture authenticates as the administrator and validates the configured institution ID and username.
2. The fixture clears the shared institution's employees, payroll, designations, custom fields, and related child records.
3. The test-specific fixture creates only the prerequisites it needs, usually through the API.
4. Playwright performs the user-visible workflow in the browser.
5. Teardown removes any marker-based temporary institutions and resets the shared institution again, including its password and login access.

Tests that create institution records use a temporary institution with a `[run-...]` marker. Institution smoke/regression tests do this to test the creation workflow, while some reports regression scenarios create an additional temporary institution to test cross-institution selection and empty states. All marker-based temporary institutions created by the selected test are deleted during teardown.

The suite runs with one Playwright worker. Desktop and mobile projects must not run concurrently because they can modify the same institution.

## Quick start

From the repository root:

```bash
bun install
cp e2e/.env.test.example e2e/.env.test
```

Fill in `e2e/.env.test` with credentials for a disposable administrator and the already-created shared E2E institution. Then start the local app:

```bash
bun run dev
```

In another terminal, run the E2E check:

```bash
bun run test:e2e -- --depth smoke --project desktop
```

`bun run dev` starts the web app at `http://localhost:5173` and the local API Worker at `http://localhost:3000` by default. If the application is already running elsewhere, set the URLs in `.env.test` or override them with `--base-url` and `--server-url`.

## Environment configuration

Copy `e2e/.env.test.example` to `e2e/.env.test`. The file is ignored by Git and is loaded automatically by the runner.

| Variable                   | Required | Purpose                                            |
| -------------------------- | -------- | -------------------------------------------------- |
| `BASE_URL`                 | No       | Browser URL; defaults to `http://localhost:5173`.  |
| `SERVER_URL`               | No       | API/auth URL; defaults to `http://localhost:3000`. |
| `TEST_IDENTIFIER`          | Yes\*    | Disposable administrator username or email.        |
| `TEST_PASSWORD`            | Yes\*    | Disposable administrator password.                 |
| `ADMIN_IDENTIFIER`         | Yes\*    | Alias for `TEST_IDENTIFIER`.                       |
| `ADMIN_PASSWORD`           | Yes\*    | Alias for `TEST_PASSWORD`.                         |
| `E2E_INSTITUTION_ID`       | Yes      | ID of the dedicated shared institution.            |
| `E2E_INSTITUTION_USERNAME` | Yes      | Username belonging to that institution ID.         |
| `E2E_INSTITUTION_PASSWORD` | Yes      | Current password for the shared institution.       |

`TEST_IDENTIFIER`/`TEST_PASSWORD` and `ADMIN_IDENTIFIER`/`ADMIN_PASSWORD` are interchangeable. Set one pair; the runner normalizes both pairs internally. Do not put passwords in source code, committed scripts, or copied command history.

\* Set either administrator pair; both pairs are not required.

The administrator and shared institution must already exist. The E2E fixture validates the configured institution; it does not create the shared tenant and does not rely on test order.

### Provisioning or rotating the disposable target

Provision the administrator and shared institution through the approved environment-owner workflow before running the suite:

1. Create or rotate the disposable administrator through the protected `/api/bootstrap/users` operational path or the approved deployment process. The server-only `BOOTSTRAP_API_SECRET` must never be placed in `e2e/.env.test` or committed.
2. Sign in as that administrator and create one dedicated institution in the disposable database. Record its institution ID, username, and password.
3. Put those values in `E2E_INSTITUTION_ID`, `E2E_INSTITUTION_USERNAME`, and `E2E_INSTITUTION_PASSWORD`. Update all three together if the tenant is recreated or its credentials are rotated.
4. Run a desktop smoke test and confirm that the fixture validates the configured ID/username and can reset the tenant.

The repository intentionally does not automate shared-tenant provisioning. This keeps test order independent and prevents an accidental run from creating an unbounded number of institutions.

The server also needs the E2E-only operational binding enabled in the disposable target:

```text
E2E_OPERATIONS_ENABLED=true
```

This is a server-side setting, normally in `apps/server/.env` for local development. The reset and cleanup endpoints require an administrator session and are disabled unless this binding is explicitly enabled. Never enable this operational path on a valuable production target.

## Smoke, regression, and cleanup

These names describe different jobs:

### Smoke

Smoke tests are the small, fast health check for a feature. Each smoke scenario covers a representative critical workflow, including the most important persistence or access assertion. Smoke is the default depth, so this command is the normal first run:

```bash
bun run test:e2e
```

Without `--project`, Playwright runs the smoke files against both the desktop and mobile projects, serially. To run only one browser profile, specify `--project desktop` or `--project mobile`.

The current smoke files are:

| Feature        | File                                 | What it checks at a high level                                                        |
| -------------- | ------------------------------------ | ------------------------------------------------------------------------------------- |
| Institution    | `tests/institution.smoke.spec.ts`    | Creates a temporary institution, verifies persistence, and checks role-based access.  |
| Employee setup | `tests/employee-setup.smoke.spec.ts` | Exercises designation setup and institution-user navigation.                          |
| Employee       | `tests/employee.smoke.spec.ts`       | Creates an employee through the UI and verifies directory persistence and navigation. |
| Payroll        | `tests/payroll.smoke.spec.ts`        | Saves payroll for a prepared employee and verifies persistence after reload.          |
| Reports        | `tests/reports.smoke.spec.ts`        | Opens a saved financial-year report as an institution user.                           |

Smoke is appropriate after starting the app, after a small change, or before spending time on the full suite. A passing smoke run is useful evidence that the deployment is reachable and the main workflows work; it is not a substitute for regression coverage.

### Regression

Regression suites are the broader feature checks. They cover validation boundaries, persistence, ordering, permissions and route guards, accessibility and keyboard workflows, responsive behavior, and controlled server/network failures. Regression does not mean “only tests that once failed”; it is the complete maintained behavior suite for that feature.

Run all regression suites on desktop with:

```bash
bun run test:e2e -- --depth regression --project desktop
```

The current feature coverage is:

| Feature        | Regression coverage                                                                                                                                                                                                                          |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Institution    | Creation-form validation, directory/details lifecycle, password reset, login access, sessions, route guards, accessibility, keyboard operation, and error recovery.                                                                          |
| Employee setup | Designation ordering and archival, custom-field configuration and form integration, access control, accessibility, keyboard operation, and error recovery.                                                                                   |
| Employee       | Form boundaries, create/edit/delete persistence, directory and CSV behavior, role protection, accessibility, keyboard operation, and network recovery. Selecting `--feature employee` also includes `employee-directory.regression.spec.ts`. |
| Payroll        | Amount and custom-field rules, unsaved changes, employee/month persistence, effective-month history, payslips, permissions, accessibility, keyboard operation, and error recovery.                                                           |
| Reports        | Financial-year selection, rows/search/pagination, administrator selection, empty states, permissions, loading/failure states, and accessibility.                                                                                             |

The exact test count changes as coverage evolves. Use the list reporter output as the authoritative count; running both projects executes each selected test against both viewports.

### Cleanup

“Cleanup” has two meanings in this repository, and they should not be confused:

- **Automatic per-test cleanup** is part of the Playwright fixture. It resets the shared tenant before and after each test and removes temporary institutions created by that test.
- **Operational cleanup** is `test:e2e:cleanup`. It is a separately guarded command for removing old institution user records generated by earlier E2E runs. It does not reset the shared tenant and it is not part of normal test execution.

The operational command only matches generated records using both of these signals:

- the institution name contains the `[run-...]` marker; and
- the institution username begins with the generated `inst_run...` prefix.

Ordinary institutions are outside the filter, even when they are owned by the same administrator.

## Running the tests

### Common commands

All commands below are run from the repository root.

```bash
# Default: all smoke features, both projects, one worker
bun run test:e2e

# All smoke features, desktop only
bun run test:e2e -- --depth smoke --project desktop

# All smoke features, mobile only
bun run test:e2e -- --depth smoke --project mobile

# One feature at one depth
bun run test:e2e -- --feature payroll --depth regression --project desktop
bun run test:e2e -- --feature reports --depth smoke --project desktop

# All desktop regression coverage
bun run test:e2e -- --depth regression --project desktop --workers 1 --retries 0

# Show the runner's supported options
bun run test:e2e -- --help
```

Supported feature values are `institution`, `employee-setup`, `employee`, `payroll`, and `reports`. Supported depth values are `smoke` and `regression`.

The runner accepts these useful options:

| Option               | Meaning                                                                       |
| -------------------- | ----------------------------------------------------------------------------- |
| `--feature <name>`   | Select one feature. Omit it to select all features at the chosen depth.       |
| `--depth <name>`     | Select `smoke` or `regression`; defaults to `smoke`.                          |
| `--project <name>`   | Select `desktop` or `mobile`; omit it to run both.                            |
| `--workers 1`        | Explicitly select the only supported worker count. Other values are rejected. |
| `--retries <count>`  | Retry failed tests; defaults to `0` so failures are visible immediately.      |
| `--headed`           | Run the selected tests in a visible browser.                                  |
| `--ui`               | Open Playwright UI mode.                                                      |
| `--base-url <url>`   | Override `BASE_URL` for this invocation.                                      |
| `--server-url <url>` | Override `SERVER_URL` for this invocation.                                    |
| `--grep <pattern>`   | Pass a Playwright filter through to run a matching test or group.             |

For example, to debug one payroll scenario in a visible desktop browser:

```bash
bun run test:e2e:headed -- --feature payroll --depth regression --project desktop --grep "Effective-Month"
```

The runner forwards unrecognized Playwright options, such as `--grep`, after processing its own options. Use `--help` to see the runner-specific options.

### Interactive debugging

```bash
# Playwright UI mode
bun run test:e2e:ui -- --feature employee --depth regression --project desktop

# Headed browser mode
bun run test:e2e:headed -- --feature employee --depth smoke --project desktop
```

These modes still use the same shared tenant and reset fixtures. Do not start two E2E commands at the same time.

### Running from the E2E workspace

The workspace has equivalent scripts if you are already in `e2e/`:

```bash
bun run test:smoke
bun run test:regression
bun run test:ui
bun run test:headed
```

The root commands are preferred because they make the repository location and the target environment more obvious.

## Operational cleanup of old generated institutions

Use cleanup only when old generated institution records need to be removed. It is intentionally a two-step process: inspect first, delete second.

### 1. Generate a dry-run report

```bash
bun run test:e2e:cleanup -- \
  --dry-run \
  --report e2e/.cleanup/generated-institutions.json \
  --expected-count 777
```

The command authenticates as the administrator, applies the marker filter, and writes a JSON report containing the matched institution IDs, user IDs, names, usernames, count, and a hash of the exact list. It does not delete anything. Review the report before continuing:

```bash
jq '{marker, matchedCount, reportHash, records: [.records[] | {institutionId, name, username}]}' \
  e2e/.cleanup/generated-institutions.json
```

The `jq` command is optional; opening the JSON file directly is also sufficient. The report is written under `e2e/.cleanup/`, which is ignored by Git.

### 2. Confirm the safety conditions

Do not proceed unless all of these are true:

- the report was produced by the dry-run you just reviewed;
- `marker` is exactly `run-`;
- `matchedCount` is exactly `777`;
- the records are all generated E2E institutions;
- the target is the disposable environment; and
- no other cleanup or E2E process is changing the database.

The value `777` is a safety contract, not an estimate. If the dry run reports 774, 778, or any other count, stop and investigate. Do not change `--expected-count` to make deletion proceed. A changed count, ID list, or report hash causes the server to reject the deletion as well.

### 3. Execute the exact reviewed list

```bash
bun run test:e2e:cleanup -- \
  --execute \
  --report e2e/.cleanup/generated-institutions.json \
  --expected-count 777
```

Execution revalidates the current marker-filtered list against the dry-run report before deleting. It deletes the generated institution user rows and relies on the database relationships to remove the associated institutions, employees, payroll records, sessions, and accounts. It does not run a broad “delete all institutions” operation.

If the command aborts, preserve the report and error message. The safe next step is to inspect the current count and IDs and obtain an explicit decision about the discrepancy; it is not to bypass the guard.

### Per-test cleanup versus operational cleanup

The operational cleanup command is not needed after every test. The fixture already removes every temporary institution created by the selected test using that test's unique run marker, including the extra institutions used by reports regression. The shared institution remains because its identity is configured in `.env.test`; only its child data and mutable login state are reset.

## What the runner does

The runner is `e2e/src/runner.ts`, wrapped by the root `test:e2e` script. It:

- loads `e2e/.env.test`;
- validates the administrator and shared institution configuration;
- selects files using the `<feature>.<depth>.spec.ts` naming convention;
- maps `--feature employee` to both employee and employee-directory regression coverage;
- starts Playwright with one worker and the selected project(s); and
- defaults to zero retries and a 120-second test timeout.

The Playwright configuration defines two projects:

| Project   | Device profile | Typical use                                  |
| --------- | -------------- | -------------------------------------------- |
| `desktop` | Desktop Chrome | Full smoke and regression coverage.          |
| `mobile`  | Pixel 7        | Mobile smoke coverage and responsive checks. |

`fullyParallel` is disabled, and the runner rejects `--workers` values other than `1`. This is intentional: browser isolation does not make concurrent writes to one tenant safe.

## Test artifacts and reading failures

The runner and Playwright create these ignored directories:

| Directory                | Contents                                                                                                                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `e2e/.manifests/`        | Per-run JSON manifests with generated-record metadata, final status, and credentials. They are ignored by Git; do not upload them. Passwords are kept out of console and HTML output. |
| `e2e/test-results/`      | Failure traces, screenshots, and videos.                                                                                                                                              |
| `e2e/playwright-report/` | The HTML report from the latest Playwright run.                                                                                                                                       |
| `e2e/.cleanup/`          | Dry-run cleanup reports.                                                                                                                                                              |

When a test fails, first read the list reporter output and then open the HTML report:

```bash
bunx playwright show-report e2e/playwright-report
```

If a failure includes a trace, open the specific archive from `e2e/test-results/`:

```bash
bunx playwright show-trace e2e/test-results/<failed-test>/trace.zip
```

The angle-bracket path above is a placeholder; replace it with the actual directory shown in the failure output.

## Troubleshooting

### Missing environment variables

The runner prints the missing names and exits before starting Playwright. Copy the example file, fill in the disposable credentials, and confirm that the institution ID and username refer to the same institution. Do not solve this by hard-coding credentials in a test.

### The shared institution cannot be found or the username does not match

The fixture intentionally fails when `E2E_INSTITUTION_ID` is absent or belongs to a different username than `E2E_INSTITUTION_USERNAME`. Check the target database and rotate `.env.test` together with the institution credentials if the tenant was recreated.

### Reset or cleanup returns 403/404

Check that the request is reaching the intended server, that the administrator credentials are valid, and that `E2E_OPERATIONS_ENABLED=true` is set in the server environment. The operational endpoints are deliberately unavailable when the binding is disabled.

### Tests collide or the runner rejects workers

Run only one E2E command at a time and leave worker count at `1`. Do not launch desktop and mobile commands concurrently. The runner rejects `--workers 2` or any other value because all feature tests use the same tenant.

### A previous run was interrupted

The fixtures use `finally` teardown, but a process kill can prevent it from running. Run one small smoke test against the same target; its automatic reset will clear the shared child data before and after the test. For example:

```bash
bun run test:e2e -- --feature employee-setup --depth smoke --project desktop
```

If the target is no longer disposable or the configured credentials have changed, stop and have the environment owner inspect it before running more tests.

### Cleanup reports the wrong count

This is a safety failure, not a flaky test. Keep the dry-run report, inspect the marker-filtered records, and confirm whether the database contains the expected generated data. Never broaden the marker or lower the expected count to force deletion.

## Adding or changing tests

Use the shared fixtures for employee, payroll, reports, and employee-setup scenarios. They provide realistic prerequisites and keep the browser portion focused on user-visible behavior.

When a test needs to verify institution creation itself, use the `temporaryInstitution` fixture and keep the generated marker on the record so teardown can remove it. Do not create a new shared institution as a prerequisite for another feature.

Name new files with the existing convention:

```text
e2e/tests/<feature>.smoke.spec.ts
e2e/tests/<feature>.regression.spec.ts
```

Keep tests independent, avoid ordering assumptions, and preserve serial execution. Run the focused feature first, then the relevant smoke or regression command, before submitting a change.

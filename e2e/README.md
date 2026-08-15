# Feature-based E2E suite

Run the Playwright suite manually against a local or staging deployment that is safe for disposable test data. Employee, payroll, reports, and employee-setup tests share one dedicated institution configured in `e2e/.env.test`; its child data is reset before and after every test. Institution-creation scenarios use generated `[run-...]` records and remove them during test teardown. Use only disposable accounts and environments—never point this suite at a valuable customer account.

## Required environment variables

- `BASE_URL` — web application URL (defaults to `http://localhost:5173`)
- `SERVER_URL` — authenticated API URL (defaults to `http://localhost:3000`)
- `TEST_IDENTIFIER` and `TEST_PASSWORD` — disposable administrator credentials
- `E2E_INSTITUTION_ID` — ID of the dedicated disposable institution
- `E2E_INSTITUTION_USERNAME` and `E2E_INSTITUTION_PASSWORD` — credentials for that institution

`ADMIN_IDENTIFIER` and `ADMIN_PASSWORD` remain supported as aliases for the administrator credentials. No generated institution password is printed to console or HTML output.

For local runs, copy `e2e/.env.test.example` to `e2e/.env.test` and fill in the values. The `.env.test` file is ignored by Git and is loaded automatically by the E2E runner. The configured administrator and institution must already exist in the target environment; E2E execution does not create either shared account.

Enable the server-side E2E operations binding only in the disposable target (`E2E_OPERATIONS_ENABLED=true`). The fixture uses it to clear the shared tenant’s child records and restore its password/login access. The endpoint requires an administrator session and is disabled by default.

Provision or rotate that disposable administrator through the protected `/api/bootstrap/users` operational endpoint or your approved deployment process, using `BOOTSTRAP_API_SECRET` from the server environment. Keep the resulting identifier and password only in `e2e/.env.test`.

The former seed-admin script has been removed because it contained committed credentials. Removing it from the current tree does not remove older Git or GitHub history, so rotate or revoke any credentials that were previously exposed and use a history-rewrite process separately if repository policy requires it.

## Commands

From the repository root:

```bash
# All five smoke features, serially against the shared tenant
bun run test:e2e -- --depth smoke

# One focused feature
bun run test:e2e -- --feature payroll --depth regression
bun run test:e2e -- --feature reports --depth smoke

# Full desktop regression, with explicit serial execution
bun run test:e2e -- --depth regression --project desktop --workers 1 --retries 0

# Focused serial debugging or a browser project
bun run test:e2e -- --depth regression --workers 1 --project desktop
bun run test:e2e -- --feature payroll --depth smoke --project mobile
```

Supported features are `institution`, `employee-setup`, `employee`, `payroll`, and `reports`. Supported depths are `smoke` and `regression`. Omitting `--feature` selects every feature at the requested depth. The runner rejects worker counts other than one because desktop and mobile projects mutate the same tenant. Retries default to zero and must be explicitly requested with `--retries <count>`.

## Cleaning old generated institutions

The cleanup command only considers rows whose institution name contains the generated `[run-...]` marker and whose username has the matching generated `inst_run...` prefix. It never targets all institutions owned by the administrator.

```bash
# Inspect the exact marker-filtered list and save a report.
bun run test:e2e:cleanup -- --dry-run --expected-count 777

# After reviewing that report, delete only the same 777 IDs if the server
# re-check still matches the report.
bun run test:e2e:cleanup -- --execute --report e2e/.cleanup/<report>.json --expected-count 777
```

Bulk deletion requires the exact `run-` marker, an administrator session, a prior dry-run report, and a current count of exactly 777. A changed count, ID list, or report hash aborts deletion. Non-E2E institutions are outside the filter.

## Artifacts and disposable data

The runner writes a JSON manifest to `e2e/.manifests/` for every test run. It records the run ID, target, feature/depth, generated credentials, created records, viewport, and final status. The directory is ignored by Git because manifests contain generated passwords. Playwright list/HTML output identifies the feature, test, and viewport without exposing those passwords. Traces, screenshots, and videos are retained on failure under `e2e/test-results/`; the HTML report is written to `e2e/playwright-report/`.

The suite uses Chromium desktop for deep regression and includes focused mobile Chromium smoke coverage. Data is reset around each test, while the dedicated institution itself remains in place. Cleanup reports are written under the ignored `e2e/.cleanup/` directory and contain generated institution metadata only.

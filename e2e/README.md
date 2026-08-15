# Feature-based E2E suite

Run the Playwright suite manually against a local or staging deployment that is safe for retained test data. Every selected feature provisions its own uniquely marked institution through normal authenticated product APIs. Created institutions, employees, payroll, and report fixtures are intentionally retained for inspection; the suite does not perform automatic cleanup. Use only a disposable test account and environment—never point this suite at a valuable customer account.

## Required environment variables

- `BASE_URL` — web application URL (defaults to `http://localhost:5173`)
- `SERVER_URL` — authenticated API URL (defaults to `http://localhost:3000`)
- `TEST_IDENTIFIER` and `TEST_PASSWORD` — disposable administrator credentials

`ADMIN_IDENTIFIER` and `ADMIN_PASSWORD` remain supported as aliases for the administrator credentials. No generated institution password is printed to console or HTML output.

## Commands

From the repository root:

```bash
# All five smoke features in parallel
bun run test:e2e -- --depth smoke

# One focused feature
bun run test:e2e -- --feature payroll --depth regression
bun run test:e2e -- --feature reports --depth smoke

# Full desktop regression, with explicit execution controls
bun run test:e2e -- --depth regression --project desktop --workers 4 --retries 0

# Serial debugging or a focused browser project
bun run test:e2e -- --depth regression --workers 1 --project desktop
bun run test:e2e -- --feature payroll --depth smoke --project mobile
```

Supported features are `institution`, `employee-setup`, `employee`, `payroll`, and `reports`. Supported depths are `smoke` and `regression`. Omitting `--feature` selects every feature at the requested depth. Independent files are scheduled across workers while tests within each feature file remain serial; use `--workers 1` for a fully serial run. Retries default to zero and must be explicitly requested with `--retries <count>`.

## Artifacts and retained data

The runner writes a JSON manifest to `e2e/.manifests/` for every test run. It records the run ID, target, feature/depth, generated credentials, created records, viewport, and final status. The directory is ignored by Git because manifests contain generated passwords. Playwright list/HTML output identifies the feature, test, and viewport without exposing those passwords. Traces, screenshots, and videos are retained on failure under `e2e/test-results/`; the HTML report is written to `e2e/playwright-report/`.

The suite uses Chromium desktop for deep regression and includes focused mobile Chromium smoke coverage. Data remains in the configured environment after success or failure so a developer can inspect it. Remove retained test data separately using an approved operational process; normal test execution never deletes broad employee, designation, or custom-field sets.

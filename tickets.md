# Tickets: Feature-Based E2E Suite

These tickets build independently runnable Playwright smoke and regression suites from the [feature-based E2E specification](docs/specs/feature-based-e2e-suite.md).

Work the **frontier**: any ticket whose blockers are all done. Implement one frontier ticket at a time in a fresh context.

## Run Institution smoke tests by feature

**What to build:** A developer can select the Institution smoke suite and run a short, realistic institution onboarding journey against the configured local, staging, or production base URL. This first tracer bullet establishes the common runner, generated run environment, artifacts, and mobile project needed by later features.

**Blocked by:** None — can start immediately.

- [x] A runner accepts Institution as a feature and smoke as a suite depth without requiring the developer to know Playwright file paths or grep expressions.
- [x] The runner validates the base URL and admin credentials supplied through environment variables and contains no hard-coded account credentials.
- [x] The smoke workflow signs in as an administrator, creates a uniquely marked institution through the browser, verifies its persisted details, signs out, signs in with the generated institution credentials, verifies role-appropriate navigation, and signs out.
- [x] The generated institution uses a realistic Indian school name, institution head, address, TAN-like value, username, and secure generated password.
- [x] A gitignored run manifest records the run ID, target URL, generated credentials, created institution details, selected feature/depth, timestamps, and final status.
- [x] Console and HTML output identify the run and generated username without printing the generated password.
- [x] The same smoke behavior runs at the standard desktop viewport and as a focused mobile Chromium check.
- [x] Chromium retains a trace, screenshot, and video when the test fails.
- [x] Retries remain disabled unless explicitly requested.
- [x] Created data is preserved after both success and failure.

## Run Employee Setup smoke tests independently

**What to build:** A developer can run Employee Setup smoke without first running Institution. The suite provisions a unique institution through existing authenticated product APIs, then proves the core designation workflow through the browser.

**Blocked by:** Run Institution smoke tests by feature.

- [x] Selecting Employee Setup smoke creates its own institution and credentials through existing authenticated APIs.
- [x] Fixture provisioning uses only normal product authentication and APIs; it does not use direct database access or a test-only endpoint.
- [x] The browser signs in as the generated institution user, creates a realistically named designation, verifies it is displayed, and signs out.
- [x] The institution user sees Employee Setup navigation and does not see administrator-only Institution navigation.
- [x] The suite can run repeatedly without colliding with retained data from earlier runs.
- [x] The desktop and mobile smoke variants both complete independently.
- [x] The run manifest records the provisioned institution and created designation.

## Run Employee smoke tests independently

**What to build:** A developer can run Employee smoke in isolation and see one realistic Indian employee created through the UI and persisted in the institution directory.

**Blocked by:** Run Institution smoke tests by feature.

- [x] Selecting Employee smoke provisions its own institution and minimum designation/custom-field prerequisites through existing authenticated APIs.
- [x] The browser signs in as the generated institution user and creates an employee using realistic Indian identity and employment data.
- [x] The workflow exercises text, date, dropdown, numeric, and configured custom-field controls through accessible browser locators.
- [x] A successful redirect or toast is not sufficient: the employee must be visible with the expected persisted values in the directory.
- [x] The workflow verifies relevant institution-user navigation and logout.
- [x] Desktop and mobile smoke variants complete independently.
- [x] The run manifest records the created employee and prerequisite records.

## Run Payroll smoke tests independently

**What to build:** A developer can run Payroll smoke in isolation and save one employee's payroll for a valid period through the browser.

**Blocked by:** Run Employee smoke tests independently.

- [x] Selecting Payroll smoke provisions a unique institution, designation, and employee through existing authenticated APIs.
- [x] The browser signs in as the institution user and selects the provisioned employee, financial year, and payroll month.
- [x] The workflow enters a realistic basic-pay amount and deduction, saves payroll, and verifies the resulting gross, deductions, and net totals.
- [x] Saved values are reloaded or revisited to demonstrate persistence beyond the success toast.
- [x] The workflow verifies relevant institution-user navigation and logout.
- [x] Desktop and mobile smoke variants complete independently.
- [x] The run manifest records the payroll employee, period, and expected amounts.

## Run Reports smoke tests independently

**What to build:** A developer can run Reports smoke in isolation and view a report backed by a uniquely provisioned institution, employee, and payroll record.

**Blocked by:** Run Payroll smoke tests independently.

- [x] Selecting Reports smoke provisions its required institution, employee, and payroll data through existing authenticated APIs.
- [x] The browser signs in as the institution user and opens the report for the provisioned financial year.
- [x] The report displays the expected employee and payroll-derived totals.
- [x] The institution-user report does not expose the administrator-only institution selector.
- [x] The workflow verifies relevant navigation and logout.
- [x] Desktop and mobile smoke variants complete independently.
- [x] The run manifest records the report fixtures and expected totals.

## Run the complete smoke suite in parallel

**What to build:** A developer can run every smoke feature together, with isolated data and understandable output, while retaining the ability to serialize or retry runs during debugging.

**Blocked by:** Run Employee Setup smoke tests independently; Run Employee smoke tests independently; Run Payroll smoke tests independently; Run Reports smoke tests independently.

- [ ] Omitting the feature selector runs every smoke feature.
- [ ] Independent feature suites run in parallel by default and never share an institution, login, or mutable fixture.
- [ ] A worker-count option can force serial execution without editing configuration.
- [ ] A retry-count option can explicitly enable retries while the default remains zero.
- [ ] Feature, depth, worker, and retry selections compose predictably in one command interface.
- [ ] List and HTML reports identify the feature and viewport for every test.
- [ ] Per-run manifests and failure artifacts remain distinguishable during parallel execution.
- [ ] Type checking and Playwright test discovery succeed for the complete smoke suite.

## Deep-test Institution and establish regression probes

**What to build:** A developer can deeply validate institution administration, authentication, access control, accessibility, and controlled failure behavior. This slice also establishes reusable regression probes that later feature suites can adopt.

**Blocked by:** Run Institution smoke tests by feature.

- [ ] Institution regression validates empty, malformed, minimum, maximum, and boundary behavior across both creation-form steps.
- [ ] A representative multi-error submission verifies error presentation, accessible associations, and useful focus behavior.
- [ ] Regression verifies the institution directory, detail persistence, password reset, old/new credential behavior, login deactivation, blocked login, reactivation, and restored login.
- [ ] Admin and institution logout are verified by attempting to revisit protected pages.
- [ ] Admin and institution route guards expose the correct navigation and deny the wrong role.
- [ ] Automated accessibility scanning fails the test for serious violations on primary Institution pages.
- [ ] Core creation, dialogs, and access-management interactions are keyboard operable with correct focus movement.
- [ ] Controlled request interception covers an unauthorized/session-expired response, server-side validation failure, temporary server failure, slow mutation, and failed save without replacing normal success-path backend calls.
- [ ] Reusable accessibility and network-failure helpers expose behavior-oriented interfaces suitable for later feature suites.
- [ ] All created institutions remain uniquely identifiable and are preserved after the run.

## Deep-test Employee Setup

**What to build:** An institution user can deeply validate designation and employee custom-field configuration, including validation, ordering, lifecycle, accessibility, and failure states.

**Blocked by:** Run Employee Setup smoke tests independently; Deep-test Institution and establish regression probes.

- [ ] Designation regression covers required and maximum-length validation, successful creation, persisted ordering, moving items up/down, and narrowly scoped archival.
- [ ] Employee custom-field regression covers required and optional fields, required/maximum-length label validation, successful creation, form visibility, ordering, and narrowly scoped archival.
- [ ] Archival affects only records created for the scenario and never performs a broad workspace reset.
- [ ] Persisted setup is verified after navigation or reload rather than only through toasts.
- [ ] Relevant unauthorized, server-error, slow-response, and failed-mutation UI states are deterministic and asserted.
- [ ] Primary setup pages pass serious accessibility scanning.
- [ ] Designation and custom-field workflows are keyboard operable, including ordering and confirmation controls.
- [ ] Institution-user login/logout and administrator-only route denial are covered within the feature.

## Deep-test employee forms and record lifecycle

**What to build:** An institution user can deeply validate employee creation, validation, persistence, editing, permissions, and narrowly scoped deletion using realistic employee records.

**Blocked by:** Run Employee smoke tests independently; Deep-test Institution and establish regression probes.

- [ ] Regression exercises every standard employee field and required/optional institution custom fields.
- [ ] Required, malformed, whole-number, positive-number, date, maximum-length, and custom-field boundaries are covered without a combinatorial explosion.
- [ ] A representative multi-error submission verifies error visibility, associations, and focus behavior.
- [ ] Successful creation is verified from persisted directory and edit-form values.
- [ ] Editing designation, seniority, contact/payroll details, and a custom value persists after navigation or reload.
- [ ] Deletion targets only an employee created for that scenario and verifies its disappearance without deleting unrelated records.
- [ ] Relevant role protection, login, and logout behavior is covered inside the feature.
- [ ] Controlled unauthorized, server-error, slow-save, and failed-save states produce usable feedback and preserve form data where appropriate.
- [ ] Primary employee form pages pass serious accessibility scanning and the critical create/edit flows are keyboard operable.

## Deep-test the employee directory and CSV export

**What to build:** An institution user can trust employee ordering, search, configurable columns, pagination, empty states, and exported CSV contents across a realistic multi-employee directory.

**Blocked by:** Deep-test employee forms and record lifecycle.

- [ ] The reusable Indian employee catalog supplies enough uniquely marked employees to cross at least one directory page boundary.
- [ ] Directory ordering follows designation order and seniority behavior for the generated records.
- [ ] Search covers visible standard fields, visible custom fields, hidden custom fields, clearing search, and no-match behavior.
- [ ] Column visibility changes the rendered table and relevant search behavior as expected.
- [ ] Pagination covers next, previous, boundary button states, filtered result counts, and return to the first page after filtering.
- [ ] CSV download verifies the suggested filename, visible headers, expected generated rows, ordering where contractual, escaping, and exclusion of hidden columns where applicable.
- [ ] Directory and export assertions ignore unrelated retained records by using the current run marker while still verifying real pagination behavior.
- [ ] Directory interactions pass serious accessibility checks and remain usable at the mobile smoke viewport.

## Deep-test payroll entry and custom fields

**What to build:** An institution user can deeply validate payroll entry, money behavior, custom earnings/deductions, unsaved changes, persistence, accessibility, and deterministic failures.

**Blocked by:** Run Payroll smoke tests independently; Deep-test Institution and establish regression probes.

- [ ] Payroll regression covers fixed earnings/deductions and representative custom earnings/deductions with realistic Indian payroll amounts.
- [ ] Money inputs cover empty, malformed, negative, decimal precision, zero, large valid values, focus formatting, and blur formatting as supported by product rules.
- [ ] Gross earnings, deductions, and net totals are asserted from the entered line items.
- [ ] Custom payroll fields cover cancel, required label, maximum length, case-insensitive duplicate detection, successful creation, focus placement, fixed-field protection, and narrowly scoped archival.
- [ ] Unsaved-change confirmation is tested for both cancel-and-stay and confirm-and-discard outcomes.
- [ ] Saved payroll is verified after reload and while switching between employees, financial years, and months.
- [ ] Controlled unauthorized, server-error, slow-save, failed-save, and stale-session states show useful feedback without corrupting saved payroll.
- [ ] Primary payroll pages pass serious accessibility scanning and core selection, entry, dialog, and save workflows are keyboard operable.
- [ ] Institution-user login/logout and relevant permission behavior are covered inside the feature.

## Deep-test payroll history and payslips

**What to build:** An institution user can trust payroll isolation, effective-month history, backdated changes, and monthly/annual payslip generation across selected employees and periods.

**Blocked by:** Deep-test payroll entry and custom fields.

- [ ] A small data-driven employee set proves payroll values do not leak between employees or financial years.
- [ ] Later-month behavior correctly reflects the previous effective values.
- [ ] Backdated changes update subsequent periods according to the product's effective-month rules.
- [ ] Earlier periods display the correct absence of previous-month values at the financial-year boundary.
- [ ] Archived custom fields remain visible where historically applicable and disappear from later applicable periods according to product behavior.
- [ ] Monthly payslip download verifies its suggested filename and that a non-empty PDF artifact is produced for the selected employee and month.
- [ ] Annual payslip download verifies its suggested filename and that a non-empty PDF artifact is produced for the selected employee and financial year.
- [ ] Failed-download behavior is simulated deterministically and produces usable feedback.
- [ ] Reloading and revisiting saved periods preserves all history assertions.

## Deep-test institution and administrator reports

**What to build:** Institution users and administrators can deeply validate report selection, rows, totals, search, pagination, empty states, permissions, accessibility, and controlled failures.

**Blocked by:** Run Reports smoke tests independently; Deep-test Institution and establish regression probes.

- [ ] Institution-user regression displays only the signed-in institution's report and does not expose the administrator institution selector.
- [ ] Administrator regression selects among uniquely generated institutions and displays the selected institution's data only.
- [ ] Financial-year selection loads the correct payroll-derived rows and totals.
- [ ] Search covers matching employees, no matches, clearing, and accurate result counts.
- [ ] A fixture large enough to cross a page boundary verifies report pagination and filtered pagination behavior.
- [ ] Empty institution and empty financial-year states provide accurate user-facing guidance.
- [ ] Unauthorized, server-error, slow-loading, and failed-report states are deterministic and asserted.
- [ ] Report pages pass serious accessibility scanning and selection/search workflows are keyboard operable.
- [ ] Admin and institution login/logout and cross-role route protection are covered inside the feature.

## Finalize full regression and retire legacy scenarios

**What to build:** A developer can run the complete production-capable regression suite in parallel using documented commands, with all valuable legacy assertions migrated and unsafe/order-dependent scenarios removed.

**Blocked by:** Run the complete smoke suite in parallel; Deep-test Employee Setup; Deep-test the employee directory and CSV export; Deep-test payroll history and payslips; Deep-test institution and administrator reports.

- [ ] Omitting the feature selector runs all regression features in parallel with isolated institutions and records.
- [ ] Any single feature can still run its smoke or regression depth independently.
- [ ] Worker and retry overrides behave consistently for full and focused runs.
- [ ] Existing high-value designation, employee, directory, CSV, payroll, payslip, and report assertions are represented in the new feature-owned suites.
- [ ] The realistic Indian school and 15-employee data are reusable fixture catalogs rather than standalone order-dependent seeding tests.
- [ ] Bulk payroll repetition is replaced by a smaller behavior-driven data matrix that covers calculations, isolation, history, and reporting.
- [ ] Hard-coded credentials, shared-account assumptions, serial cross-feature dependencies, broad employee deletion, broad custom-field archival, and broad designation archival are removed from normal execution.
- [ ] Documentation explains required environment variables, feature/depth selection, full smoke/regression commands, workers, retries, artifacts, manifests, retained production data, and the absence of automatic cleanup.
- [ ] The run manifest directory and all generated sensitive artifacts are ignored by version control.
- [ ] Playwright discovery, E2E type checking, repository checks, every feature smoke suite, and the full regression command pass against an appropriate configured environment.

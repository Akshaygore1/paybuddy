# Feature-Based E2E Smoke and Regression Suite

## Problem Statement

The existing Playwright suite cannot be run reliably feature by feature. Its strongest coverage is concentrated in one serial institution-user journey that mixes employee setup, employee directory behavior, payroll, reports, and destructive cleanup. Two additional scenarios behave more like data-seeding scripts: they use hard-coded institution credentials, depend on previously created data, and repeat bulk employee and payroll entry without isolating failures.

As a result, a developer cannot quickly determine whether only Institution, Employee Setup, Employee, Payroll, or Reports works. A payroll failure may originate in employee preparation; a shared-account reset may delete unrelated records; rerunning bulk scenarios may collide with existing data; and the current single-worker configuration prevents a fast parallel regression run. The suite also lacks explicit smoke versus deep regression profiles, admin institution workflows, logout coverage, mobile checks, accessibility checks, and deterministic server-error coverage.

The application needs a production-capable, manually invoked E2E suite whose feature areas are independently runnable, fast enough for focused validation, and comprehensive enough for deep regression testing.

## Solution

Restructure the Playwright suite around five independently runnable user-facing features: Institution, Employee Setup, Employee, Payroll, and Reports. Each feature provides a fast smoke profile and a deep regression profile. Running one feature creates its own uniquely identified institution environment and only the prerequisite records that feature needs.

Use the highest existing seams available:

- Authenticate with the configured admin account and use the application's existing authenticated APIs to provision prerequisite data.
- Exercise the selected feature's owned behavior through the browser UI and assert externally observable outcomes.
- Do not introduce a test-only backend endpoint.
- Include the login, logout, access, and role behavior relevant to each feature inside that feature instead of creating a separate authentication feature.

Full smoke or regression runs execute independent feature suites in parallel. Dependent steps inside a single workflow remain sequential. Tests run in Chromium, with comprehensive desktop regression and a focused mobile smoke pass. Created data remains available after the run for inspection, and a gitignored run manifest records the generated institution credentials and data identifiers.

## User Stories

1. As a developer, I want to run only Institution tests, so that I can validate institution behavior without running employee or payroll scenarios.
2. As a developer, I want to run only Employee Setup tests, so that I can validate designations and employee custom fields independently.
3. As a developer, I want to run only Employee tests, so that I can diagnose employee-directory and employee-form failures quickly.
4. As a developer, I want to run only Payroll tests, so that payroll defects are not obscured by unrelated feature failures.
5. As a developer, I want to run only Reports tests, so that I can validate reporting behavior using focused fixtures.
6. As a developer, I want to run every feature in one regression command, so that I can assess the complete product before or after deployment.
7. As a developer, I want a smoke profile, so that I can get fast surface-level confidence in the primary workflow.
8. As a developer, I want a regression profile, so that I can deeply test success paths, validation, permissions, edge cases, and failures.
9. As a developer, I want every selected feature to provision its own prerequisites, so that it never depends on another feature having run first.
10. As a developer, I want feature suites to run in parallel by default, so that complete regression finishes sooner.
11. As a developer debugging a failure, I want to force one worker, so that execution and artifacts are easier to follow.
12. As a developer, I want zero automatic retries by default, so that flaky behavior remains visible.
13. As a developer testing an unstable remote environment, I want to opt into a retry, so that I can distinguish transient failures without changing configuration.
14. As a developer, I want the suite to use `BASE_URL`, so that the same commands work against local, staging, and production deployments.
15. As an administrator, I want credentials to come from environment variables, so that secrets are never hard-coded in tests.
16. As a developer, I want generated institutions to have realistic Indian school names, so that retained production test data is recognizable and understandable.
17. As a developer, I want generated employees to use realistic Indian names and employment data, so that forms, tables, reports, and downloads resemble actual usage.
18. As a developer, I want each generated school to carry a unique E2E run marker, so that parallel and repeated runs do not collide.
19. As a developer, I want a run manifest containing the generated login and created records, so that I can inspect the retained environment after a test.
20. As a developer, I want the run manifest ignored by Git, so that generated passwords and runtime data are not committed.
21. As a developer, I want successful and failed test data preserved, so that I can inspect the resulting institution environment after execution.
22. As an administrator, I want Institution smoke coverage to create an institution and verify its login, so that the most important onboarding workflow is continuously checked.
23. As an administrator, I want Institution regression to validate both steps of the creation form, so that required fields and credential constraints remain enforced.
24. As an administrator, I want Institution regression to verify the directory and institution detail page, so that created profile and login information is persisted correctly.
25. As an administrator, I want Institution regression to reset a password and verify the new credential, so that credential recovery is trustworthy.
26. As an administrator, I want Institution regression to disable and re-enable login access, so that institutional access can be controlled.
27. As an administrator, I want Institution regression to test admin and institution logout, so that sessions terminate correctly.
28. As an institution user, I want role-appropriate navigation and route protection checked, so that I cannot access administrator-only institution management.
29. As an institution user, I want Employee Setup smoke coverage to create a designation, so that employee creation can be unlocked.
30. As an institution user, I want Employee Setup regression to validate designation names, so that empty and overlong names are rejected.
31. As an institution user, I want Employee Setup regression to reorder designations, so that employee seniority grouping remains controllable.
32. As an institution user, I want Employee Setup regression to archive a designation through the visible workflow, so that designation lifecycle behavior is checked.
33. As an institution user, I want Employee Setup regression to create required and optional employee custom fields, so that configurable employee records are covered.
34. As an institution user, I want Employee Setup regression to reorder and archive custom fields, so that form configuration changes remain correct.
35. As an institution user, I want Employee smoke coverage to create one employee and find it in the directory, so that the primary employee workflow is quickly verified.
36. As an institution user, I want Employee regression to exercise every standard employee field, so that persisted employee records are complete.
37. As an institution user, I want Employee regression to test empty, malformed, maximum-length, and boundary values, so that employee validation is trustworthy.
38. As an institution user, I want Employee regression to test required custom fields, so that institution-specific rules are enforced.
39. As an institution user, I want Employee regression to edit an employee and verify the persisted result, so that record maintenance is covered.
40. As an institution user, I want Employee regression to delete a specifically created employee, so that the visible employee lifecycle is tested without broad workspace resets.
41. As an institution user, I want Employee regression to verify designation and seniority ordering, so that directory ordering remains stable.
42. As an institution user, I want Employee regression to search visible standard and custom columns, so that directory filtering matches user expectations.
43. As an institution user, I want Employee regression to toggle directory columns, so that hidden fields affect display and search correctly.
44. As an institution user, I want Employee regression to create enough employees to cross a page boundary, so that pagination behavior is verified.
45. As an institution user, I want Employee regression to download and inspect the CSV, so that exported headers, rows, and visible columns are correct.
46. As an institution user, I want Payroll smoke coverage to save payroll for one employee and period, so that the primary payroll workflow is quickly checked.
47. As an institution user, I want Payroll regression to test earnings and deductions, so that gross, deduction, and net totals remain accurate.
48. As an institution user, I want Payroll regression to test valid and invalid monetary input boundaries, so that money values cannot be silently corrupted.
49. As an institution user, I want Payroll regression to add and archive custom payroll fields, so that configurable earnings and deductions are covered.
50. As an institution user, I want Payroll regression to validate empty, duplicate, case-insensitive duplicate, and overlong custom-field names, so that payroll configuration rules remain enforced.
51. As an institution user, I want Payroll regression to verify unsaved-change prompts, so that navigation or configuration changes do not discard work silently.
52. As an institution user, I want Payroll regression to reload saved payroll, so that persistence is verified rather than inferred from a success message.
53. As an institution user, I want Payroll regression to switch employees, financial years, and months, so that payroll records remain correctly isolated.
54. As an institution user, I want Payroll regression to verify effective-month history, so that later and backdated changes follow the expected timeline behavior.
55. As an institution user, I want Payroll regression to download monthly and annual payslips, so that filenames and generated documents are available.
56. As an institution user, I want Reports smoke coverage to display the current financial-year report, so that the primary reporting page is quickly verified.
57. As an institution user, I want Reports regression to verify employee rows, totals, financial years, empty states, searching, and pagination, so that report behavior is comprehensive.
58. As an administrator, I want Reports regression to select an institution, so that administrator reporting across schools is covered.
59. As a user, I want serious accessibility violations to fail regression, so that common accessibility regressions are caught early.
60. As a keyboard user, I want important forms, dialogs, dropdowns, and navigation to work without a mouse, so that core workflows remain operable.
61. As a mobile user, I want each feature's primary workflow checked at a mobile Chromium viewport, so that responsive navigation and forms do not break.
62. As a developer, I want controlled unauthorized, server-error, slow-response, failed-save, and failed-download scenarios, so that error and loading states are deterministic.
63. As a developer, I want screenshots, traces, and videos retained on failure, so that I can diagnose browser and network behavior.
64. As a developer, I want generated data and test status recorded by run ID, so that artifacts can be correlated with the retained production records.
65. As a maintainer, I want existing high-value assertions migrated into feature-owned suites, so that restructuring does not discard useful regression coverage.
66. As a maintainer, I want hard-coded bulk school scripts converted into reusable curated fixtures, so that test data is shared without creating hidden ordering dependencies.
67. As a maintainer, I want feature-aware form drivers rather than a generic form crawler, so that tests understand business meaning and verify saved results.
68. As a maintainer, I want test names to describe observable behavior, so that reports identify the failing capability clearly.
69. As a maintainer, I want new user-visible feature changes accompanied by Playwright coverage, so that the suite grows with the product.
70. As a developer, I want smoke and regression selection to compose with feature selection, worker count, and retry options, so that the runner remains flexible without many one-off scripts.

## Implementation Decisions

- Organize the suite by the user-visible feature areas Institution, Employee Setup, Employee, Payroll, and Reports rather than by database tables or one long business journey.
- Give every feature separate smoke and regression coverage.
- Provide a runner interface that accepts a feature selector, a suite-depth selector, worker count, and retry count. Omitting the feature selector runs all features for the selected depth.
- Keep authentication coverage inside each relevant feature. Do not introduce a standalone Auth feature.
- Make every feature independently runnable. It must create the minimum institution, credentials, designations, employees, payroll, or report data that it needs.
- Use existing authenticated product APIs for prerequisite creation. Do not add a test-only backend endpoint or depend on direct database access.
- Exercise the behavior owned by the selected feature through the browser UI. API fixture creation is preparation, not the assertion seam.
- Use an admin identifier and password supplied through environment variables. Remove all hard-coded account credentials from the suite.
- Continue using `BASE_URL` as the environment selector and support local, staging, and production targets. The suite is intended for manual execution and will not assume CI.
- Create a separate uniquely marked institution environment for each feature run or parallel worker.
- Use a curated data catalog of realistic Indian school names, institution heads, addresses, designations, employee names, Indian phone numbers, PAN-like values, and plausible payroll amounts.
- Add a short unique E2E run marker to values that must be globally unique while keeping displayed data readable.
- Persist a gitignored JSON run manifest containing the run ID, base URL, timestamp, selected feature and depth, generated institution login and password, created record identifiers or names, and final status.
- Preserve created data after both successful and failed runs. Do not perform broad preflight resets or automatic post-run cleanup.
- Run independent feature suites concurrently by default. Keep operations that form one dependent business workflow sequential.
- Use Chromium only for the initial implementation.
- Use a standard desktop viewport for deep regression and a mobile Chromium viewport for a focused smoke pass.
- Keep retries disabled by default and allow explicit retry configuration.
- Keep the existing list and HTML reporting, and retain trace, screenshot, and video artifacts on failure.
- Use explicit, feature-aware form data and reusable control helpers for text inputs, dates, checkboxes, dialogs, and shadcn select/dropdown interactions.
- Verify persisted or downloaded results after actions; do not treat a click, redirect, or toast alone as proof of success.
- Split the current serial institution-user journey along feature ownership boundaries.
- Convert the existing 15-employee school dataset into reusable curated data. Employee regression should create enough employees to test pagination.
- Replace the bulk 15-employee payroll repetition with a smaller data-driven set of employees chosen to cover calculation, record isolation, custom fields, historical behavior, and reports.
- Remove the workspace-wide deletion and archival reset from normal suite execution.
- Keep deletion or archival tests narrowly scoped to records created specifically for that scenario.
- Use deterministic browser request interception only for deliberate loading and failure-state cases; normal success paths continue to use the real deployed backend.
- Add automated accessibility scanning at each primary regression page and explicit keyboard/focus assertions for important interactive workflows.
- Avoid pixel-by-pixel screenshot baselines in the initial implementation.

## Testing Decisions

- A good E2E test asserts behavior visible to the user or observable in a user-requested artifact. It should select controls using accessible roles and labels, perform a meaningful workflow, and verify persisted UI state, downloaded content, navigation, permissions, or error feedback.
- Tests must not assert internal React state, implementation-specific hooks, database queries, or private module behavior.
- Each scenario owns its data and must not depend on another spec having completed.
- Smoke tests cover the shortest representative successful workflow, relevant login/logout behavior, role-appropriate navigation, and a mobile usability pass.
- Regression tests cover successful workflows, meaningful field boundaries, required and malformed inputs, dependent controls, persistence, permissions, empty states, error states, keyboard behavior, accessibility, downloads, and mobile surface coverage.
- Validation uses input classes and boundaries rather than the full combinatorial product of every invalid field with every other invalid field.
- One representative multi-error submission should verify that multiple errors are presented and focus behavior is usable.
- Institution coverage includes admin sign-in and sign-out, two-step creation, form validation, directory and detail persistence, institution sign-in and sign-out, password reset, login deactivation/reactivation, and role protection.
- Employee Setup coverage includes designation creation, validation, ordering, archival, required and optional custom-field creation, custom-field ordering, and archival.
- Employee coverage includes form fields and validation, custom fields, creation, persistence, editing, narrowly scoped deletion, directory ordering, search, column visibility, pagination, CSV download content, login/logout, and permissions.
- Payroll coverage includes employee/year/month selection, fixed and custom earnings and deductions, money validation and formatting, totals, unsaved changes, persistence across reload and selectors, effective-month history, custom-field lifecycle, monthly payslip download, annual payslip download, login/logout, and permissions.
- Reports coverage includes institution-user and admin views, institution selection where applicable, financial-year selection, employee rows, totals, searching, pagination, empty states, downloads where exposed, login/logout, and permissions.
- Controlled interception covers unauthorized responses, session expiration, backend validation errors, temporary server failures, slow responses, failed saves, and failed downloads.
- Accessibility checks include automated serious-violation scanning, form labels and error relationships, keyboard completion of critical paths, and focus behavior for dialogs and dropdowns.
- Responsive checks focus on mobile navigation, non-overflowing forms/tables, dialogs, and the primary success workflow for each feature.
- Prior art to preserve includes the existing designation-ordering assertions, required employee custom-field validation, employee directory ordering and persisted values, search behavior, visible-column behavior, CSV content validation, employee editing, payroll custom-field validation, money formatting and calculations, payroll persistence and effective-month history, payslip downloads, and report searching.
- Existing broad cleanup helpers are negative prior art for production-capable regression and must not be used by the new runner.
- Existing bulk school scenarios are prior art for realistic Indian datasets but not for suite dependency or hard-coded credentials.
- New user-visible workflows added to these feature areas should extend the corresponding Playwright regression suite; unit tests are not introduced for this work.

## Out of Scope

- Designing or implementing a cleanup command for retained E2E institutions and their related records.
- Automatically deleting data after successful or failed runs.
- Adding a test-only API endpoint or direct production database access.
- Running the suite automatically in CI.
- Supporting browsers other than Chromium.
- Full pixel-level visual regression or screenshot snapshot baselines.
- Exhaustively testing every mathematical combination of invalid form values.
- Full accessibility certification beyond automated scanning and targeted interaction coverage.
- Reworking application business logic, schemas, or UI solely to change behavior not required for stable external E2E seams.
- Adding unit tests.
- Treating production E2E records as real customer or payroll data.

## Further Notes

- The current suite has ten tests across three specifications. Its primary serial scenario already contains much of the product's strongest behavioral coverage and should be decomposed rather than discarded.
- The production-capable nature of this runner makes unique run markers and per-worker environments essential because retained data and parallel execution are intentional.
- A fixture created through an existing API does not prove that feature's UI. Therefore Institution creation is performed in the Institution UI tests, while other feature suites may provision an institution through the API before testing their own UI.
- The generated run manifest is sensitive because it contains a valid institution password. Its location must be ignored by version control, and normal console/HTML output should show the run ID and username without printing the password.
- Cleanup remains a future, separately specified concern. Until then, clear E2E markers make retained records identifiable without granting this suite broad deletion behavior.

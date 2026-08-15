# Repository Guidelines

## Project Structure & Module Organization

This is a Bun workspace for a Cloudflare application. `apps/web` contains the React Router frontend; routes live in `src/routes`, reusable app components in `src/components`, and browser-side helpers in `src/lib`. `apps/server/src/index.ts` is the Hono Worker entry point. Shared tRPC routers, schemas, and business modules belong in `packages/api`; Drizzle schemas and generated SQL migrations belong in `packages/db/src`; authentication, environment validation, UI primitives, and infrastructure are separated into `packages/auth`, `packages/env`, `packages/ui`, and `packages/infra`. Playwright scenarios live in `e2e/tests`, while longer design and research notes live in `docs`.

## Build, Test, and Development Commands

- `bun install` installs all workspace dependencies (Bun 1.3+).
- `bun run dev` starts the web app and local Cloudflare/D1 stack; use `dev:web` or `dev:server` to narrow the scope.
- `bun run build` builds all packages that expose a build script.
- `bun run check` runs Vite Plus checks and workspace type checks; `bun run lint` and `bun run format` run those steps separately.
- `bun run test` runs the Playwright E2E suite. Use `test:e2e:ui` or `test:e2e:headed` for interactive debugging.
- `bun run db:generate` creates a Drizzle migration after schema changes.

## Coding Style & Naming Conventions

Write TypeScript/TSX using two-space indentation, double quotes, and semicolons; Vite Plus enforces formatting and linting. Run `bun run check` before submitting. Use kebab-case filenames (`employee-form.tsx`), PascalCase React components, camelCase functions and variables, and descriptive plural tRPC router names. Keep route filenames consistent with React Router conventions, such as `employee.$employeeId.edit.tsx`. Import shared code through `@tds-nivaran/*` workspace aliases.

## Testing Guidelines

The active suite is Playwright. Do not add unit tests; cover user-visible behavior with E2E scenarios instead. Name scenarios `*.spec.ts` under `e2e/tests`. Tests run serially in Chromium and may delete data owned by the configured disposable account. Set `BASE_URL`, `TEST_IDENTIFIER`, and `TEST_PASSWORD`; never point the suite at a valuable account. Add or update an E2E scenario for user-visible workflow changes.

## Commit & Pull Request Guidelines

History favors short, imperative subjects (for example, `Add effective-month payroll history`), with occasional Conventional Commit scopes such as `refactor(api): ...`. Keep each commit focused. Pull requests should summarize behavior and architecture changes, link the relevant issue, list verification commands, and include screenshots for UI work. Call out migrations, environment changes, and destructive E2E assumptions explicitly.

## Domain Terms & Core Context

- **Institution**: A customer organization that uses TDS Nivaran to manage payroll-related Employee data.
- **Institution account**: The admin-managed account row and Login Access for an Institution, backed by a Better Auth user.
- **Employee**: A person whose payroll-related details are managed by an Institution.
- **Employee record**: The stored base fields, Designation, and Custom Field values for one Employee.
- **Designation**: An Institution-defined role/title option used on Employee records and ordered in Employee Setup.
- **Custom Field**: An Institution-defined Employee record field with a label, generated key, required flag, active flag, and display order.
- **Payroll field timeline**: The effective-month history that determines when an Institution-defined Payroll field participates in Payroll.
- **Payroll Financial Year**: The user-selected April-through-March calendar used to prepare and review Payroll.
- **Login Access**: Whether the Better Auth user for an Institution account is allowed to sign in.

## Architecture Context

- Employee record behavior lives behind the Employee record module, with the tRPC router acting as a narrow procedure adapter.
- Institution account behavior lives behind the Institution account module. Bootstrap user endpoints remain separate operational paths.
- Access context: `adminProcedure`, `userProcedure`, `institutionProcedure`, `AdminRouteGuard`, and `UserRouteGuard`.
